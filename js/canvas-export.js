import db from './db.js';
import { showToast } from './helpers.js';

export function downloadCanvasPng(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

export function exportBillImage({ roomName, month, people, kwh, roomCost, waterCost, electricCost, total, electricPriceVal, waterPriceVal }) {
    const fmt = (n) => Number(n).toLocaleString('vi-VN') + '\u0111';
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 500);

    ctx.fillStyle = '#333';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('H\u00d3A \u0110\u01a0N TI\u1ec0N NH\u00c0', 400, 60);

    ctx.font = '18px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText(`${roomName}  \u2014  Th\u00e1ng ${month}`, 400, 95);

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 115); ctx.lineTo(760, 115); ctx.stroke();

    const rows = [
        ['Ti\u1ec1n ph\u00f2ng', fmt(roomCost)],
        [`Ti\u1ec1n n\u01b0\u1edbc (${people} ng\u01b0\u1eddi \u00d7 ${fmt(waterPriceVal * 1000)})`, fmt(waterCost)],
        [`Ti\u1ec1n \u0111i\u1ec7n (${kwh} kWh \u00d7 ${fmt(electricPriceVal)})`, fmt(electricCost)],
    ];
    let y = 165;
    rows.forEach(([label, value]) => {
        ctx.textAlign = 'left';  ctx.fillStyle = '#444'; ctx.font = '17px Arial';
        ctx.fillText(label, 60, y);
        ctx.textAlign = 'right'; ctx.fillStyle = '#222'; ctx.font = 'bold 17px Arial';
        ctx.fillText(value, 740, y);
        y += 60;
    });

    ctx.strokeStyle = '#bbb';
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(760, y); ctx.stroke();

    ctx.textAlign = 'left';  ctx.fillStyle = '#e94560'; ctx.font = 'bold 22px Arial';
    ctx.fillText('T\u1ed4NG C\u1ed8NG', 60, y + 50);
    ctx.textAlign = 'right'; ctx.font = 'bold 28px Arial';
    ctx.fillText(fmt(total), 740, y + 50);

    const link = document.createElement('a');
    link.download = `hoadon-${roomName}-T${month.replace('/', '-')}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
}

export function exportElectricTable(sortedRooms, meterMap, billMonth) {
    const year = billMonth.year;
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(`${m}/${year}`);

    const dataRows = sortedRooms.map(room => {
        const roomData = meterMap[room.id] || {};
        // Get December of previous year for January kWh calculation
        const decPrev = roomData[`12/${year - 1}`];
        const prevYearReading = (decPrev && decPrev.value != null && decPrev.value !== '') ? Number(decPrev.value) : null;

        const readings = months.map(month => {
            const meter = roomData[month];
            return (meter && meter.value != null && meter.value !== '') ? Number(meter.value) : null;
        });
        let totalKwh = 0;
        const cells = months.map((_, i) => {
            const val = readings[i];
            const prev = i > 0 ? readings[i - 1] : prevYearReading;
            const kwh = (val !== null && prev !== null) ? Math.max(0, val - prev) : null;
            if (kwh !== null) totalKwh += kwh;
            return { val, kwh };
        });
        return { name: room.name, cells, totalKwh };
    });

    const monthTotals = months.map((_, i) => {
        let sum = 0;
        dataRows.forEach(row => { if (row.cells[i].kwh !== null) sum += row.cells[i].kwh; });
        return sum;
    });
    const grandTotalKwh = monthTotals.reduce((a, b) => a + b, 0);

    const colW = 70, rowH = 48, nameW = 100, totalW = 70;
    const cols = months.length;
    const headerH = 36;
    const titleH = 50;
    const totalRowH = 36;
    const W = nameW + cols * colW + totalW + 2;
    const H = titleH + headerH + dataRows.length * rowH + totalRowH + 2;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#333'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`\u26a1 B\u1ea3ng s\u1ed1 \u0111i\u1ec7n n\u0103m ${year}`, W / 2, 32);

    const startY = titleH;
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, startY, W, headerH);
    ctx.fillStyle = '#fff';
    ctx.fillText('Ph\u00f2ng', nameW / 2, startY + 22);
    for (let i = 0; i < cols; i++) ctx.fillText('T' + (i + 1), nameW + i * colW + colW / 2, startY + 22);
    ctx.fillText('T\u1ed5ng', nameW + cols * colW + totalW / 2, startY + 22);

    dataRows.forEach((row, ri) => {
        const y = startY + headerH + ri * rowH;
        ctx.fillStyle = ri % 2 === 0 ? '#f8f8f8' : '#fff';
        ctx.fillRect(0, y, W, rowH);

        ctx.fillStyle = '#222'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'left';
        ctx.fillText(row.name, 8, y + 20);

        row.cells.forEach((cell, ci) => {
            const cx = nameW + ci * colW + colW / 2;
            if (cell.val !== null) {
                ctx.fillStyle = '#444'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
                ctx.fillText(String(cell.val), cx, y + 18);
            }
            if (cell.kwh !== null) {
                ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
                ctx.fillText(String(cell.kwh), cx, y + 36);
            }
        });

        if (row.totalKwh > 0) {
            ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
            ctx.fillText(String(row.totalKwh), nameW + cols * colW + totalW / 2, y + 26);
        }
    });

    const ty = startY + headerH + dataRows.length * rowH;
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, ty, W, totalRowH);
    ctx.fillStyle = '#222'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'left';
    ctx.fillText('T\u1ed4NG', 8, ty + 22);
    months.forEach((_, i) => {
        if (monthTotals[i] > 0) {
            ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
            ctx.fillText(String(monthTotals[i]), nameW + i * colW + colW / 2, ty + 22);
        }
    });
    if (grandTotalKwh > 0) {
        ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
        ctx.fillText(String(grandTotalKwh), nameW + cols * colW + totalW / 2, ty + 22);
    }

    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= dataRows.length + 1; i++) {
        const y = startY + headerH + i * (i <= dataRows.length ? rowH : 0);
        if (i <= dataRows.length) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }
    ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ty + totalRowH); ctx.lineTo(W, ty + totalRowH); ctx.stroke();
    for (let i = 0; i <= cols + 2; i++) {
        const x = i === 0 ? 0 : i === 1 ? nameW : i <= cols + 1 ? nameW + (i - 1) * colW : W;
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, H); ctx.stroke();
    }

    downloadCanvasPng(canvas, `so-dien-${year}.png`);
    showToast('\u0110\u00e3 t\u1ea3i \u1ea3nh b\u1ea3ng s\u1ed1 \u0111i\u1ec7n');
}

export async function exportAllBills() {
    const rooms = await db.getAllRooms();
    const tenants = await db.getAllTenants();
    const tenantMap = {};
    tenants.forEach(t => { if (t.roomId) tenantMap[t.roomId] = t; });

    const billRooms = rooms.filter(r => r.lastBill).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    if (billRooms.length === 0) {
        showToast('Ch\u01b0a c\u00f3 ph\u00f2ng n\u00e0o \u0111\u00e3 t\u00ednh ti\u1ec1n');
        return;
    }

    const fmtShort = (n) => {
        n = Number(n);
        if (n >= 1000) { const k = n / 1000; return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K'; }
        return String(n);
    };
    const headers = ['Ph\u00f2ng', 'Ng\u01b0\u1eddi thu\u00ea', 'Ph\u00f2ng', 'N\u01b0\u1edbc', '\u0110i\u1ec7n', 'T\u1ed5ng'];
    const colWidths = [110, 90, 65, 55, 55, 75];
    const rowH = 36, headerH = 36, titleH = 50;
    const W = colWidths.reduce((a, b) => a + b, 0) + 2;
    const H = titleH + headerH + billRooms.length * rowH + rowH + 2;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#333'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText('\ud83d\udcb0 T\u1ed5ng h\u1ee3p ti\u1ec1n ph\u00f2ng', W / 2, 32);

    const startY = titleH;

    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, startY, W, headerH);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial';
    let hx = 0;
    headers.forEach((h, i) => {
        ctx.textAlign = i < 2 ? 'left' : 'right';
        const tx = i < 2 ? hx + 8 : hx + colWidths[i] - 8;
        ctx.fillText(h, tx, startY + 22);
        hx += colWidths[i];
    });

    let grandTotal = 0;
    billRooms.forEach((room, ri) => {
        const y = startY + headerH + ri * rowH;
        const tenant = tenantMap[room.id];
        const d = room.lastBillDetails || {};
        const roomCost = d.roomCost || (room.price || 0) * 1000;
        grandTotal += room.lastBill;

        ctx.fillStyle = ri % 2 === 0 ? '#f8f8f8' : '#fff';
        ctx.fillRect(0, y, W, rowH);

        const vals = [
            room.name + (room.lastBillMonth ? ' (T' + room.lastBillMonth + ')' : ''),
            tenant ? tenant.name : '\u2014',
            fmtShort(roomCost),
            d.waterCost !== undefined ? fmtShort(d.waterCost) : '\u2014',
            d.electricCost !== undefined ? fmtShort(d.electricCost) : '\u2014',
            fmtShort(room.lastBill)
        ];

        let x = 0;
        vals.forEach((v, i) => {
            ctx.fillStyle = i === 5 ? '#e94560' : '#333';
            ctx.font = i === 5 ? 'bold 12px Arial' : '12px Arial';
            ctx.textAlign = i < 2 ? 'left' : 'right';
            const tx = i < 2 ? x + 8 : x + colWidths[i] - 8;
            ctx.fillText(v, tx, y + 22);
            x += colWidths[i];
        });
    });

    const ty = startY + headerH + billRooms.length * rowH;
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, ty, W, rowH);
    ctx.fillStyle = '#222'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'left';
    ctx.fillText('T\u1ed4NG C\u1ed8NG', 8, ty + 22);
    ctx.fillStyle = '#e94560'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'right';
    ctx.fillText(fmtShort(grandTotal), W - 8, ty + 22);

    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= billRooms.length + 1; i++) {
        const y = startY + headerH + i * rowH;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    let lx = 0;
    for (let i = 0; i <= headers.length; i++) {
        ctx.beginPath(); ctx.moveTo(lx, startY); ctx.lineTo(lx, H); ctx.stroke();
        lx += colWidths[i] || 0;
    }

    downloadCanvasPng(canvas, 'tong-hop-tien-phong.png');
    showToast('\u0110\u00e3 t\u1ea3i \u1ea3nh t\u1ed5ng h\u1ee3p');
}
