import db from './db.js';
import state from './state.js';
import { $, showToast, getBillMonth, getKwhForMonth } from './helpers.js';
import { speak } from './voice.js';
import { openModal, shareOrCopy } from './ui.js';
import { exportBillImage } from './canvas-export.js';

export async function showBillForm(roomId) {
    const room = await db.getRoom(roomId);
    if (!room) return;
    const tenants = await db.getTenantsByRoom(roomId);
    const tenant = tenants[0];
    const electricPrice = await db.getSetting('electricPrice') || 0;
    const waterPrice = await db.getSetting('waterPrice') || 0;
    const billMonth = getBillMonth();
    const defaultMonth = billMonth.month;
    const defaultYear = billMonth.year;

    const roomMeters = await db.getMetersByRoom(roomId);
    const people = room.people || 0;

    // Build month options for the year
    const monthOptions = [];
    for (let m = 1; m <= 12; m++) {
        monthOptions.push(`<option value="${m}" ${m === defaultMonth ? 'selected' : ''}>Th\u00e1ng ${m}</option>`);
    }

    openModal(`T\u00ednh ti\u1ec1n - ${room.name}`, `
        <div id="bill-form">
            <div class="form-group" style="margin-bottom:12px">
                <label>Th\u00e1ng t\u00ednh ti\u1ec1n</label>
                <div style="display:flex;gap:8px">
                    <select id="f-bill-month" style="flex:1">${monthOptions.join('')}</select>
                    <input type="number" id="f-bill-year" value="${defaultYear}" style="flex:1;width:80px" min="2020" max="2099">
                </div>
            </div>
            <div class="detail-row" style="margin-bottom:8px;padding:8px;background:var(--bg);border-radius:8px">
                <span class="label">S\u1ed1 ng\u01b0\u1eddi</span>
                <span class="value">${people > 0 ? `<strong>${people} ng\u01b0\u1eddi</strong>` : '<span style="color:var(--accent)">Ch\u01b0a nh\u1eadp (v\u00e0o tab \u0110i\u1ec7n & N\u01b0\u1edbc)</span>'}</span>
            </div>
            <div id="bill-electric-info" class="detail-row" style="margin-bottom:12px;padding:8px;background:var(--bg);border-radius:8px">
                <span class="label">S\u1ed1 \u0111i\u1ec7n</span>
                <span class="value" id="bill-kwh-display"></span>
            </div>
            <button class="btn btn-primary" id="btn-calc-bill">T\u00ednh</button>
        </div>
        <div id="bill-result" style="display:none;margin-top:16px">
            <div class="detail-section">
                <h3>Chi ti\u1ebft</h3>
                <div class="detail-row"><span class="label">Ti\u1ec1n ph\u00f2ng</span><span class="value" id="bill-room"></span></div>
                <div class="detail-row"><span class="label">Ti\u1ec1n n\u01b0\u1edbc</span><span class="value" id="bill-water"></span></div>
                <div class="detail-row"><span class="label">Ti\u1ec1n \u0111i\u1ec7n</span><span class="value" id="bill-electric"></span></div>
                <div class="detail-row" style="font-weight:700;font-size:1.2rem"><span class="label">T\u1ed5ng c\u1ed9ng</span><span class="value" id="bill-total" style="color:var(--accent-light)"></span></div>
            </div>
            <button class="btn btn-secondary" id="btn-export-bill" style="margin-top:4px">Xu\u1ea5t \u1ea3nh h\u00f3a \u0111\u01a1n</button>
        </div>
    `);

    // Update kWh display when month changes
    function updateKwhDisplay() {
        const m = Number($('#f-bill-month').value);
        const y = Number($('#f-bill-year').value);
        const monthKey = `${m}/${y}`;
        const kwhInfo = getKwhForMonth(roomMeters, monthKey);
        const display = $('#bill-kwh-display');
        if (kwhInfo) {
            display.innerHTML = `${kwhInfo.previous} \u2192 ${kwhInfo.current} = <strong>${kwhInfo.kwh} kWh</strong>`;
        } else {
            display.innerHTML = '<span style="color:var(--accent)">Ch\u01b0a \u0111\u1ee7 d\u1eef li\u1ec7u (v\u00e0o tab \u0110i\u1ec7n & N\u01b0\u1edbc)</span>';
        }
    }
    updateKwhDisplay();
    $('#f-bill-month').addEventListener('change', updateKwhDisplay);
    $('#f-bill-year').addEventListener('change', updateKwhDisplay);

    $('#btn-calc-bill').addEventListener('click', async () => {
        const m = Number($('#f-bill-month').value);
        const y = Number($('#f-bill-year').value);
        const monthKey = `${m}/${y}`;
        const kwhInfo = getKwhForMonth(roomMeters, monthKey);
        const kwh = kwhInfo ? kwhInfo.kwh : 0;

        const roomCost = (room.price || 0) * 1000;
        const waterCost = people * waterPrice * 1000;
        const electricCost = kwh * electricPrice;
        const total = roomCost + waterCost + electricCost;

        room.lastBill = total;
        room.lastBillMonth = monthKey;
        room.lastBillDetails = { people, kwh, roomCost, waterCost, electricCost, electricPrice, waterPrice };
        await db.saveRoom(room);

        const fmt = (n) => Number(n).toLocaleString('vi-VN') + '\u0111';
        $('#bill-room').textContent = fmt(roomCost);
        $('#bill-water').textContent = fmt(waterCost) + ` (${people} ng\u01b0\u1eddi \u00d7 ${fmt(waterPrice * 1000)})`;
        $('#bill-electric').textContent = fmt(electricCost) + ` (${kwh} kWh \u00d7 ${fmt(electricPrice)})`;
        $('#bill-total').textContent = fmt(total);
        $('#bill-result').style.display = 'block';

        $('#btn-export-bill').onclick = () => exportBillImage({
            roomName: room.name,
            month: monthKey,
            people, kwh, roomCost, waterCost, electricCost, total,
            electricPriceVal: electricPrice,
            waterPriceVal: waterPrice
        });

        speak(`T\u1ed5ng c\u1ed9ng ${fmt(total)}`, `Total ${fmt(total)}`);
        state.renderPage();
    });
}

export async function exportBill(roomId) {
    const room = await db.getRoom(roomId);
    if (!room || !room.lastBill) return;
    const tenants = await db.getTenantsByRoom(roomId);
    const tenant = tenants[0];
    const d = room.lastBillDetails || {};
    const fmt = (n) => Number(n).toLocaleString('vi-VN') + '\u0111';

    let text = `\ud83d\udccb ${room.name} - Th\u00e1ng ${room.lastBillMonth || '?'}\n`;
    if (tenant) text += `\ud83d\udc64 ${tenant.name}\n`;
    text += `---\n`;
    text += `\ud83c\udfe0 Ti\u1ec1n ph\u00f2ng: ${fmt(d.roomCost || (room.price || 0) * 1000)}\n`;
    if (d.waterCost !== undefined) text += `\ud83d\udca7 Ti\u1ec1n n\u01b0\u1edbc: ${fmt(d.waterCost)} (${d.people} ng\u01b0\u1eddi \u00d7 ${fmt(d.waterPrice * 1000)})\n`;
    if (d.electricCost !== undefined) text += `\u26a1 Ti\u1ec1n \u0111i\u1ec7n: ${fmt(d.electricCost)} (${d.kwh} kWh \u00d7 ${fmt(d.electricPrice)})\n`;
    text += `---\n`;
    text += `\ud83d\udcb0 T\u1ed5ng c\u1ed9ng: ${fmt(room.lastBill)}`;

    shareOrCopy(text, '\u0110\u00e3 sao ch\u00e9p h\u00f3a \u0111\u01a1n');
}

export async function calculateAllBills() {
    const rooms = await db.getAllRooms();
    const electricPrice = await db.getSetting('electricPrice') || 0;
    const waterPrice = await db.getSetting('waterPrice') || 0;
    const billMonth = getBillMonth();
    const currentMonth = `${billMonth.month}/${billMonth.year}`;

    let count = 0;
    for (const room of rooms) {
        if (room.status !== 'occupied') continue;

        const people = room.people || 0;
        const roomMeters = await db.getMetersByRoom(room.id);
        const kwhInfo = getKwhForMonth(roomMeters, currentMonth);
        const kwh = kwhInfo ? kwhInfo.kwh : 0;

        const roomCost = (room.price || 0) * 1000;
        const waterCost = people * waterPrice * 1000;
        const electricCost = kwh * electricPrice;
        const total = roomCost + waterCost + electricCost;

        room.lastBill = total;
        room.lastBillMonth = currentMonth;
        room.lastBillDetails = { people, kwh, roomCost, waterCost, electricCost, electricPrice, waterPrice };
        await db.saveRoom(room);
        count++;
    }

    showToast(`\u0110\u00e3 t\u00ednh ti\u1ec1n ${count} ph\u00f2ng`);
    state.renderPage();
}
