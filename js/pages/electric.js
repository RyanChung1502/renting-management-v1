import db from '../db.js';
import { $, showToast, getBillMonth, getKwhForMonth } from '../helpers.js';
import { exportElectricTable } from '../canvas-export.js';

export async function renderElectricPage() {
    const mainContent = $('#main-content');
    const rooms = await db.getAllRooms();
    const meters = await db.getAllMeters();
    const billMonth = getBillMonth();
    const year = billMonth.year;

    // Build meter map: roomId -> { "1/2026": { value }, ... }
    const meterMap = {};
    meters.forEach(m => {
        if (!meterMap[m.roomId]) meterMap[m.roomId] = {};
        meterMap[m.roomId][m.month] = m;
    });

    const sortedRooms = rooms.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));

    // Generate month keys for current year
    const monthKeys = [];
    for (let m = 1; m <= 12; m++) monthKeys.push(`${m}/${year}`);

    mainContent.innerHTML = `
        <div class="electric-page">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p style="color:var(--text-secondary)">N\u0103m: <strong>${year}</strong></p>
                <button class="btn-bill btn-export" id="btn-export-electric" style="flex:none;padding:6px 14px;font-size:0.9rem">Xu\u1ea5t file</button>
            </div>
            ${sortedRooms.length === 0 ? '<p style="text-align:center;color:var(--text-secondary)">Ch\u01b0a c\u00f3 ph\u00f2ng n\u00e0o</p>' :
            sortedRooms.map(room => {
                const roomData = meterMap[room.id] || {};
                const ppl = room.people || 0;

                // Compute current month kWh
                const currentMonthKey = `${billMonth.month}/${billMonth.year}`;
                const meterArr = meters.filter(m => m.roomId === room.id);
                const kwhInfo = getKwhForMonth(meterArr, currentMonthKey);

                return `
                <div class="electric-card" data-room-id="${room.id}">
                    <div class="electric-card-header">
                        <span class="room-name">${room.name}</span>
                        <div style="display:flex;gap:6px">
                            ${ppl > 0 ? `<span class="electric-kwh" style="background:rgba(52,152,219,0.15);color:#3498db">${ppl} ng\u01b0\u1eddi</span>` : ''}
                            ${kwhInfo ? `<span class="electric-kwh">${kwhInfo.kwh} kWh</span>` : ''}
                        </div>
                    </div>
                    <div class="electric-inputs" style="flex-wrap:wrap">
                        <div class="form-group" style="flex:0 0 100%;margin:0 0 8px 0">
                            <label>S\u1ed1 ng\u01b0\u1eddi</label>
                            <input type="number" class="elec-people" data-room="${room.id}" value="${ppl || ''}" min="0" placeholder="0">
                        </div>
                        ${monthKeys.map(mk => {
                            const m = roomData[mk];
                            const val = m && m.value != null && m.value !== '' ? m.value : '';
                            const monthNum = mk.split('/')[0];
                            return `
                            <div class="form-group" style="flex:1 1 calc(25% - 6px);min-width:70px;margin:0">
                                <label>T${monthNum}</label>
                                <input type="number" class="elec-month" data-room="${room.id}" data-month="${mk}" value="${val}" placeholder="\u2014">
                            </div>`;
                        }).join('')}
                    </div>
                    <div style="display:flex;justify-content:flex-end;margin-top:8px">
                        <button class="btn-save-meter" data-room="${room.id}" title="L\u01b0u">\u2713 L\u01b0u</button>
                    </div>
                </div>`;
            }).join('')}
        </div>`;

    // Save handlers
    document.querySelectorAll('.btn-save-meter').forEach(btn => {
        btn.addEventListener('click', async () => {
            const roomId = btn.dataset.room;
            const card = btn.closest('.electric-card');
            const peopleValue = card.querySelector('.elec-people').value;

            // Save all month readings
            const monthInputs = card.querySelectorAll('.elec-month');
            const existingMeters = await db.getMetersByRoom(roomId);

            for (const input of monthInputs) {
                const monthKey = input.dataset.month;
                const val = input.value;
                let meter = existingMeters.find(m => m.month === monthKey);

                if (val !== '') {
                    if (!meter) meter = { roomId, month: monthKey };
                    meter.value = Number(val);
                    await db.saveMeter(meter);
                } else if (meter && (meter.value != null && meter.value !== '')) {
                    // Clear the value
                    meter.value = null;
                    await db.saveMeter(meter);
                }
            }

            // Save people count to room
            const room = await db.getRoom(roomId);
            if (room) {
                room.people = peopleValue !== '' ? Number(peopleValue) : 0;
                await db.saveRoom(room);
            }

            showToast('\u0110\u00e3 l\u01b0u');
            renderElectricPage();
        });
    });

    document.getElementById('btn-export-electric')?.addEventListener('click', () => {
        exportElectricTable(sortedRooms, meterMap, billMonth);
    });
}
