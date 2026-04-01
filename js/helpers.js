export const $ = (sel) => document.querySelector(sel);

export function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'toast show';
    setTimeout(() => { toast.className = 'toast'; }, 2500);
}

export function formatCurrency(amount) {
    if (!amount) return '0\u0111';
    return Number(amount).toLocaleString('vi-VN') + '.000\u0111';
}

export function formatDate(dateStr) {
    if (!dateStr) return '\u2014';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
}

export function getContractStatus(endDate, hasStart) {
    if (!endDate) return hasStart ? { text: 'Kh\u00f4ng th\u1eddi h\u1ea1n', cls: 'active' } : { text: 'Kh\u00f4ng c\u00f3 H\u0110', cls: '' };
    const end = new Date(endDate);
    const now = new Date();
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { text: 'H\u1ebft h\u1ea1n', cls: 'expired' };
    if (daysLeft <= 30) return { text: `C\u00f2n ${daysLeft} ng\u00e0y`, cls: 'expiring' };
    return { text: 'C\u00f2n hi\u1ec7u l\u1ef1c', cls: 'active' };
}

export function getBillMonth() {
    const now = new Date();
    const day = now.getDate();
    if (day >= 25 || day <= 5) {
        return { month: now.getMonth() + 1, year: now.getFullYear() };
    } else {
        let m = now.getMonth();
        let y = now.getFullYear();
        if (m === 0) { m = 12; y--; }
        return { month: m, year: y };
    }
}

// Get previous month key given a month key like "3/2026"
export function getPrevMonth(monthKey) {
    const [m, y] = monthKey.split('/').map(Number);
    if (m === 1) return `12/${y - 1}`;
    return `${m - 1}/${y}`;
}

// Compute kWh for a given month from meter readings
// meters: array of { month, value } for a room
// monthKey: "3/2026"
// Returns { kwh, current, previous } or null if data missing
export function getKwhForMonth(meters, monthKey) {
    const prevKey = getPrevMonth(monthKey);
    const current = meters.find(m => m.month === monthKey);
    const previous = meters.find(m => m.month === prevKey);
    if (!current || current.value == null || current.value === '') return null;
    if (!previous || previous.value == null || previous.value === '') return null;
    return {
        kwh: Math.max(0, Number(current.value) - Number(previous.value)),
        current: Number(current.value),
        previous: Number(previous.value),
    };
}
