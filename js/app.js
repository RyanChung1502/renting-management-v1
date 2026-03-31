// ===== App State =====
let currentPage = 'rooms';
let searchQuery = '';
let voiceEnabled = false;

// ===== Voice =====
let cachedVoices = [];
if (window.speechSynthesis) {
    cachedVoices = speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', () => {
        cachedVoices = speechSynthesis.getVoices();
    });
}

function speak(viText, enText) {
    if (!voiceEnabled || !window.speechSynthesis) return;
    // Fix Android Chrome bug: resume if paused
    speechSynthesis.cancel();
    // Re-fetch voices in case they weren't loaded
    if (cachedVoices.length === 0) {
        cachedVoices = speechSynthesis.getVoices();
    }
    const viVoice = cachedVoices.find(v => v.lang.startsWith('vi'));
    const utter = new SpeechSynthesisUtterance(viVoice ? viText : (enText || viText));
    if (viVoice) {
        utter.voice = viVoice;
        utter.lang = 'vi-VN';
    } else {
        // Try to find any English voice
        const enVoice = cachedVoices.find(v => v.lang.startsWith('en'));
        if (enVoice) utter.voice = enVoice;
        utter.lang = 'en-US';
    }
    utter.rate = 1;
    utter.volume = 1;
    speechSynthesis.speak(utter);
}

// ===== Toast =====
function showToast(msg) {
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

// ===== DOM References =====
const $ = (sel) => document.querySelector(sel);
const mainContent = $('#main-content');
const fab = $('#fab');
const searchBar = $('#search-bar');
const searchInput = $('#search-input');
const sideMenu = $('#side-menu');
const menuOverlay = $('#menu-overlay');
const modalOverlay = $('#modal-overlay');
const modalTitle = $('#modal-title');
const modalBody = $('#modal-body');
const pageTitle = $('#page-title');

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    voiceEnabled = (await db.getSetting('voiceEnabled')) || false;
    // Preload voices
    speechSynthesis.getVoices();
    setupEventListeners();
    renderPage();
});

// ===== Event Listeners =====
function setupEventListeners() {
    // Search
    $('#btn-search').addEventListener('click', () => {
        searchBar.classList.toggle('hidden');
        if (!searchBar.classList.contains('hidden')) {
            searchInput.focus();
        } else {
            searchInput.value = '';
            searchQuery = '';
            renderPage();
        }
    });
    $('#btn-search-close').addEventListener('click', () => {
        searchBar.classList.add('hidden');
        searchInput.value = '';
        searchQuery = '';
        renderPage();
    });
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderPage();
    });

    // Menu
    $('#btn-menu').addEventListener('click', openMenu);
    menuOverlay.addEventListener('click', closeMenu);
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
            currentPage = e.target.dataset.page;
            closeMenu();
            renderPage();
        });
    });

    // Quick Backup
    $('#btn-backup').addEventListener('click', async () => {
        const backup = await db.exportAll();
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rentmgr-latest.json';
        a.click();
        URL.revokeObjectURL(url);
        speak('Đã sao lưu', 'Backup done');
        showToast('Đã sao lưu!');
    });

    // Refresh
    $('#btn-refresh').addEventListener('click', async (e) => {
        e.preventDefault();
        closeMenu();
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
        if (navigator.serviceWorker) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.unregister();
        }
        location.reload(true);
    });

    // FAB
    fab.addEventListener('click', () => {
        if (currentPage === 'rooms') {
            speak('Thêm phòng mới', 'Add new room');
            showRoomForm();
        } else if (currentPage === 'tenants') {
            speak('Thêm người thuê mới', 'Add a new tenant');
            showTenantForm();
        }
    });

    // Modal
    $('#modal-close').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}

// ===== Menu =====
function openMenu() {
    menuOverlay.classList.remove('hidden');
    sideMenu.classList.remove('hidden');
    requestAnimationFrame(() => sideMenu.classList.add('open'));
}

function closeMenu() {
    sideMenu.classList.remove('open');
    setTimeout(() => {
        sideMenu.classList.add('hidden');
        menuOverlay.classList.add('hidden');
    }, 300);
}

// ===== Modal =====
function openModal(title, bodyHTML) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHTML;
    modalOverlay.classList.remove('hidden');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
}

// ===== Page Router =====
function renderPage() {
    switch (currentPage) {
        case 'rooms':
            pageTitle.textContent = 'Danh sách phòng';
            fab.classList.remove('hidden');
            renderRoomList();
            break;
        case 'tenants':
            pageTitle.textContent = 'Người thuê';
            fab.classList.remove('hidden');
            renderTenantList();
            break;
        case 'electric':
            pageTitle.textContent = 'Điện & Nước';
            fab.classList.add('hidden');
            renderElectricPage();
            break;
        case 'settings':
            pageTitle.textContent = 'Cài đặt';
            fab.classList.add('hidden');
            renderSettingsPage();
            break;
        case 'backup':
            pageTitle.textContent = 'Sao lưu / Khôi phục';
            fab.classList.add('hidden');
            renderBackupPage();
            break;
    }
}

// ===== Format Helpers =====
function formatCurrency(amount) {
    if (!amount) return '0đ';
    return Number(amount).toLocaleString('vi-VN') + '.000đ';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
}

function getContractStatus(endDate, hasStart) {
    if (!endDate) return hasStart ? { text: 'Không thời hạn', cls: 'active' } : { text: 'Không có HĐ', cls: '' };
    const end = new Date(endDate);
    const now = new Date();
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { text: 'Hết hạn', cls: 'expired' };
    if (daysLeft <= 30) return { text: `Còn ${daysLeft} ngày`, cls: 'expiring' };
    return { text: 'Còn hiệu lực', cls: 'active' };
}

// ===== Room List =====
async function renderRoomList() {
    const rooms = await db.getAllRooms();
    const tenants = await db.getAllTenants();

    // Build room-tenant map
    const tenantMap = {};
    tenants.forEach(t => {
        if (t.roomId) tenantMap[t.roomId] = t;
    });

    let filtered = rooms;
    if (searchQuery) {
        filtered = rooms.filter(r => {
            const tenant = tenantMap[r.id];
            return r.name.toLowerCase().includes(searchQuery) ||
                   (tenant && tenant.name.toLowerCase().includes(searchQuery));
        });
    }

    // Sort: occupied first, then by name
    filtered.sort((a, b) => {
        if (a.status === b.status) return a.name.localeCompare(b.name);
        return a.status === 'occupied' ? -1 : 1;
    });

    if (filtered.length === 0) {
        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="emoji">🏠</div>
                <p>${searchQuery ? 'Không tìm thấy phòng nào' : 'Chưa có phòng nào'}</p>
                <p style="margin-top:8px;font-size:0.85rem">Nhấn nút + để thêm phòng mới</p>
            </div>`;
        return;
    }

    mainContent.innerHTML = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px;padding:0 4px">
        <button class="btn-bill" onclick="calculateAllBills()" style="flex:none;padding:6px 14px;font-size:0.9rem">Tính tất cả</button>
        <button class="btn-bill btn-export" onclick="exportAllBills()" style="flex:none;padding:6px 14px;font-size:0.9rem">Xuất tổng hợp</button>
    </div><div class="room-list">${filtered.map(room => {
        const tenant = tenantMap[room.id];
        const status = room.status || 'vacant';
        let tenantHTML = '';
        if (tenant) {
            const contract = getContractStatus(tenant.contractEnd, tenant.contractStart);
            tenantHTML = `
                <div class="room-tenant">
                    👤 ${tenant.name}${tenant.phone ? ' · ' + tenant.phone : ''}
                    ${contract.cls ? `<span class="contract-status ${contract.cls}">${contract.text}</span>` : ''}
                </div>`;
        }
        return `
            <div class="room-card ${status}" onclick="showRoomDetail('${room.id}')">
                <div class="room-card-header">
                    <span class="room-name">${room.name}</span>
                    <span class="room-status ${status}">${status === 'occupied' ? 'Đang thuê' : 'Trống'}</span>
                </div>
                <div class="room-info">
                    <span>${formatCurrency(room.price)}/tháng</span>
                    <span>Tổng: ${room.lastBill ? Number(room.lastBill).toLocaleString('vi-VN') + 'đ' : '0đ'}</span>
                </div>
                ${tenantHTML}
                ${status === 'occupied' ? `<div class="room-card-actions">
                    <button class="btn-bill" onclick="event.stopPropagation(); showBillForm('${room.id}')">Tính tiền</button>
                    ${room.lastBill ? `<button class="btn-bill btn-export" onclick="event.stopPropagation(); exportBill('${room.id}')">Xuất gửi</button>` : ''}
                </div>` : ''}
            </div>`;
    }).join('')}</div>`;
}

// ===== Room Detail =====
async function showRoomDetail(roomId) {
    const room = await db.getRoom(roomId);
    if (!room) return;

    const tenants = await db.getTenantsByRoom(roomId);
    const tenant = tenants[0];

    let tenantHTML = '<p style="color:var(--text-secondary)">Chưa có người thuê</p>';
    if (tenant) {
        const contract = getContractStatus(tenant.contractEnd, tenant.contractStart);
        tenantHTML = `
            <div class="detail-row"><span class="label">Tên</span><span class="value">${tenant.name}</span></div>
            <div class="detail-row"><span class="label">SĐT</span><span class="value"><a href="tel:${tenant.phone}">${tenant.phone || '—'}</a></span></div>
            <div class="detail-row"><span class="label">CCCD/CMND</span><span class="value">${tenant.idNumber || '—'}</span></div>
            <div class="detail-row"><span class="label">Ngày bắt đầu</span><span class="value">${formatDate(tenant.contractStart)}</span></div>
            <div class="detail-row"><span class="label">Ngày kết thúc</span><span class="value">${formatDate(tenant.contractEnd)}</span></div>
            <div class="detail-row"><span class="label">Hợp đồng</span><span class="value"><span class="contract-status ${contract.cls}">${contract.text}</span></span></div>`;
    }

    openModal(room.name, `
        <div class="detail-section">
            <h3>Thông tin phòng</h3>
            <div class="detail-row"><span class="label">Tên phòng</span><span class="value">${room.name}</span></div>
            <div class="detail-row"><span class="label">Giá thuê</span><span class="value">${formatCurrency(room.price)}/tháng</span></div>
            <div class="detail-row"><span class="label">Đặt cọc</span><span class="value">${formatCurrency(room.deposit)}</span></div>
            <div class="detail-row"><span class="label">Trạng thái</span><span class="value">${room.status === 'occupied' ? 'Đang thuê' : 'Trống'}</span></div>
            <div class="detail-row"><span class="label">Số điện cũ</span><span class="value">${room.electricOld != null ? room.electricOld : '—'}</span></div>
            <div class="detail-row"><span class="label">Số điện mới</span><span class="value">${room.electricNew != null ? room.electricNew : '—'}</span></div>
            <div class="detail-row"><span class="label">Tiền phòng tháng này</span><span class="value" style="color:var(--accent-light)">${room.lastBill ? Number(room.lastBill).toLocaleString('vi-VN') + 'đ' : '0đ'}${room.lastBillMonth ? ' (T' + room.lastBillMonth + ')' : ''}</span></div>
        </div>
        <div class="detail-section">
            <h3>Người thuê</h3>
            ${tenantHTML}
        </div>
        ${room.status === 'occupied' ? `<button class="btn btn-primary" onclick="showBillForm('${room.id}')" style="margin-bottom:8px">Tính tiền</button>` : ''}
        <div class="detail-actions">
            <button class="btn btn-secondary" onclick="showRoomForm('${room.id}')">Sửa</button>
            <button class="btn btn-danger" onclick="confirmDeleteRoom('${room.id}')">Xóa</button>
        </div>
        ${tenant ? `<button class="btn btn-secondary" onclick="showTenantForm('${tenant.id}')">Sửa người thuê</button>` :
                    `<button class="btn btn-secondary" onclick="showTenantForm(null, '${room.id}')">Thêm người thuê</button>`}
    `);
}

// ===== Bill Calculation =====
function getBillMonth() {
    const now = new Date();
    const day = now.getDate();
    // Cuối tháng (>=25) hoặc đầu tháng (<=5) → tính tháng hiện tại
    // Giữa tháng → tính tháng trước
    if (day >= 25 || day <= 5) {
        return { month: now.getMonth() + 1, year: now.getFullYear() };
    } else {
        let m = now.getMonth(); // 0-indexed, so this is previous month
        let y = now.getFullYear();
        if (m === 0) { m = 12; y--; }
        return { month: m, year: y };
    }
}

async function showBillForm(roomId) {
    const room = await db.getRoom(roomId);
    if (!room) return;
    const tenants = await db.getTenantsByRoom(roomId);
    const tenant = tenants[0];
    const electricPrice = await db.getSetting('electricPrice') || 0;
    const waterPrice = await db.getSetting('waterPrice') || 0;
    const billMonth = getBillMonth();
    const currentMonth = `${billMonth.month}/${billMonth.year}`;

    // Get electric meter from electric tab
    const roomMeters = await db.getMetersByRoom(roomId);
    const currentMeter = roomMeters.find(m => m.month === currentMonth);
    const elecOld = currentMeter ? currentMeter.oldValue : (room.electricOld ?? '');
    const elecNew = currentMeter ? currentMeter.newValue : (room.electricNew ?? '');
    const kwh = (elecOld !== '' && elecNew !== '') ? Math.max(0, Number(elecNew) - Number(elecOld)) : 0;

    const people = room.people || 0;

    openModal(`Tính tiền - ${room.name}`, `
        <p style="margin-bottom:12px;color:var(--text-secondary)">Tháng ${currentMonth}</p>
        <div id="bill-form">
            <div class="detail-row" style="margin-bottom:8px;padding:8px;background:var(--bg);border-radius:8px">
                <span class="label">Số người</span>
                <span class="value">${people > 0 ? `<strong>${people} người</strong>` : '<span style="color:var(--accent)">Chưa nhập (vào tab Điện & Nước)</span>'}</span>
            </div>
            <div class="detail-row" style="margin-bottom:12px;padding:8px;background:var(--bg);border-radius:8px">
                <span class="label">Số điện</span>
                <span class="value">${elecOld !== '' && elecNew !== '' ? `${elecOld} → ${elecNew} = <strong>${kwh} kWh</strong>` : '<span style="color:var(--accent)">Chưa nhập (vào tab Điện & Nước)</span>'}</span>
            </div>
            <button class="btn btn-primary" id="btn-calc-bill">Tính</button>
        </div>
        <div id="bill-result" style="display:none;margin-top:16px">
            <div class="detail-section">
                <h3>Chi tiết</h3>
                <div class="detail-row"><span class="label">Tiền phòng</span><span class="value" id="bill-room"></span></div>
                <div class="detail-row"><span class="label">Tiền nước</span><span class="value" id="bill-water"></span></div>
                <div class="detail-row"><span class="label">Tiền điện</span><span class="value" id="bill-electric"></span></div>
                <div class="detail-row" style="font-weight:700;font-size:1.2rem"><span class="label">Tổng cộng</span><span class="value" id="bill-total" style="color:var(--accent-light)"></span></div>
            </div>
            <button class="btn btn-secondary" id="btn-export-bill" style="margin-top:4px">Xuất ảnh hóa đơn</button>
        </div>
    `);

    $('#btn-calc-bill').addEventListener('click', async () => {
        const roomCost = (room.price || 0) * 1000;
        const waterCost = people * waterPrice * 1000;
        const electricCost = kwh * electricPrice;
        const total = roomCost + waterCost + electricCost;

        // Save bill to room
        room.lastBill = total;
        room.lastBillMonth = currentMonth;
        room.lastBillDetails = { people, kwh, roomCost, waterCost, electricCost, electricPrice, waterPrice };
        await db.saveRoom(room);

        const fmt = (n) => Number(n).toLocaleString('vi-VN') + 'đ';
        $('#bill-room').textContent = fmt(roomCost);
        $('#bill-water').textContent = fmt(waterCost) + ` (${people} người × ${fmt(waterPrice * 1000)})`;
        $('#bill-electric').textContent = fmt(electricCost) + ` (${kwh} kWh × ${fmt(electricPrice)})`;
        $('#bill-total').textContent = fmt(total);
        $('#bill-result').style.display = 'block';

        $('#btn-export-bill').onclick = () => exportBillImage({
            roomName: room.name,
            month: currentMonth,
            people, kwh, roomCost, waterCost, electricCost, total,
            electricPriceVal: electricPrice,
            waterPriceVal: waterPrice
        });

        speak(`Tổng cộng ${fmt(total)}`, `Total ${fmt(total)}`);
        renderPage();
    });
}

// ===== Export Bill =====
async function exportBill(roomId) {
    const room = await db.getRoom(roomId);
    if (!room || !room.lastBill) return;
    const tenants = await db.getTenantsByRoom(roomId);
    const tenant = tenants[0];
    const d = room.lastBillDetails || {};
    const fmt = (n) => Number(n).toLocaleString('vi-VN') + 'đ';

    let text = `📋 ${room.name} - Tháng ${room.lastBillMonth || '?'}\n`;
    if (tenant) text += `👤 ${tenant.name}\n`;
    text += `---\n`;
    text += `🏠 Tiền phòng: ${fmt(d.roomCost || (room.price || 0) * 1000)}\n`;
    if (d.waterCost !== undefined) text += `💧 Tiền nước: ${fmt(d.waterCost)} (${d.people} người × ${fmt(d.waterPrice)})\n`;
    if (d.electricCost !== undefined) text += `⚡ Tiền điện: ${fmt(d.electricCost)} (${d.kwh} kWh × ${fmt(d.electricPrice)})\n`;
    text += `---\n`;
    text += `💰 Tổng cộng: ${fmt(room.lastBill)}`;

    shareOrCopy(text, 'Đã sao chép hóa đơn');
}

function copyToClipboard(text, toastMsg) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(toastMsg || 'Đã sao chép');
    }).catch(() => {
        showToast('Không thể sao chép');
    });
}

// ===== Room Form =====
async function showRoomForm(roomId) {
    let room = { name: '', price: '', deposit: '', status: 'vacant' };
    let existingTenant = null;
    if (roomId) {
        room = await db.getRoom(roomId) || room;
        const tenants = await db.getTenantsByRoom(roomId);
        existingTenant = tenants[0] || null;
    }

    openModal(roomId ? 'Sửa phòng' : 'Thêm phòng', `
        <form id="room-form">
            <div class="form-group">
                <label>Tên/Số phòng *</label>
                <input type="text" id="f-room-name" value="${room.name}" required placeholder="VD: Phòng 101">
            </div>
            <div class="form-group">
                <label>Giá thuê (1000đ/tháng)</label>
                <input type="number" id="f-room-price" value="${room.price || ''}" placeholder="VD: 3000">
            </div>
            <div class="form-group">
                <label>Tiền đặt cọc (1000đ)</label>
                <input type="number" id="f-room-deposit" value="${room.deposit || ''}" placeholder="VD: 3000">
            </div>
            <div class="form-group">
                <label>Số điện cũ (kỳ trước)</label>
                <input type="number" id="f-room-elec-old" value="${room.electricOld != null ? room.electricOld : ''}" placeholder="VD: 1234">
            </div>
            <div class="form-group">
                <label>Số điện mới (kỳ này)</label>
                <input type="number" id="f-room-elec-new" value="${room.electricNew != null ? room.electricNew : ''}" placeholder="VD: 1356">
            </div>
            <div class="form-group">
                <label>Tên khách thuê</label>
                <input type="text" id="f-room-tenant" value="${existingTenant ? existingTenant.name : ''}" placeholder="VD: Nguyễn Văn A">
            </div>
            <button type="submit" class="btn btn-primary">Lưu</button>
        </form>
    `);

    $('#room-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const tenantName = $('#f-room-tenant').value.trim();
        const data = {
            ...room,
            name: $('#f-room-name').value.trim(),
            price: $('#f-room-price').value ? Number($('#f-room-price').value) : null,
            deposit: $('#f-room-deposit').value ? Number($('#f-room-deposit').value) : null,
            electricOld: $('#f-room-elec-old').value !== '' ? Number($('#f-room-elec-old').value) : null,
            electricNew: $('#f-room-elec-new').value !== '' ? Number($('#f-room-elec-new').value) : null,
            status: tenantName ? 'occupied' : 'vacant'
        };
        if (!data.name) return;
        await db.saveRoom(data);

        // Create or update tenant
        if (tenantName) {
            const tenantData = existingTenant || { roomId: data.id };
            tenantData.name = tenantName;
            tenantData.roomId = data.id;
            await db.saveTenant(tenantData);
        } else if (existingTenant) {
            // Remove tenant if name cleared
            await db.deleteTenant(existingTenant.id);
        }

        speak('Đã lưu phòng ' + data.name, 'Room ' + data.name + ' saved');
        showToast('Đã lưu ' + data.name);
        closeModal();
        renderPage();
    });
}

// ===== Delete Room =====
async function confirmDeleteRoom(roomId) {
    const room = await db.getRoom(roomId);
    if (!room) return;

    openModal('Xác nhận xóa', `
        <p style="margin-bottom:16px">Bạn có chắc muốn xóa <strong>${room.name}</strong>?<br>
        <span style="color:var(--danger);font-size:0.9rem">Người thuê liên kết cũng sẽ bị xóa.</span></p>
        <button class="btn btn-danger" onclick="deleteRoom('${roomId}')">Xóa</button>
        <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    `);
}

async function deleteRoom(roomId) {
    await db.deleteRoom(roomId);
    speak('Đã xóa phòng', 'Room deleted');
    closeModal();
    renderPage();
}

// ===== Tenant List =====
async function renderTenantList() {
    const tenants = await db.getAllTenants();
    const rooms = await db.getAllRooms();

    const roomMap = {};
    rooms.forEach(r => { roomMap[r.id] = r; });

    let filtered = tenants;
    if (searchQuery) {
        filtered = tenants.filter(t =>
            t.name.toLowerCase().includes(searchQuery) ||
            (t.phone && t.phone.includes(searchQuery)) ||
            (t.roomId && roomMap[t.roomId] && roomMap[t.roomId].name.toLowerCase().includes(searchQuery))
        );
    }

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="emoji">👤</div>
                <p>${searchQuery ? 'Không tìm thấy người thuê' : 'Chưa có người thuê nào'}</p>
                <p style="margin-top:8px;font-size:0.85rem">Nhấn nút + để thêm người thuê</p>
            </div>`;
        return;
    }

    mainContent.innerHTML = `<div class="tenant-list">${filtered.map(t => {
        const room = roomMap[t.roomId];
        const contract = getContractStatus(t.contractEnd, t.contractStart);
        return `
            <div class="tenant-card" onclick="showTenantDetail('${t.id}')">
                <div class="tenant-name">${t.name}</div>
                <div class="tenant-phone">${t.phone || 'Chưa có SĐT'}</div>
                ${room ? `<div class="tenant-room">🏠 ${room.name}</div>` : ''}
                ${contract.cls ? `<span class="contract-status ${contract.cls}">${contract.text}</span>` : ''}
            </div>`;
    }).join('')}</div>`;
}

// ===== Tenant Detail =====
async function showTenantDetail(tenantId) {
    const tenant = await db.getTenant(tenantId);
    if (!tenant) return;

    let roomName = '—';
    if (tenant.roomId) {
        const room = await db.getRoom(tenant.roomId);
        if (room) roomName = room.name;
    }

    const contract = getContractStatus(tenant.contractEnd, tenant.contractStart);

    openModal(tenant.name, `
        <div class="detail-section">
            <h3>Thông tin cá nhân</h3>
            <div class="detail-row"><span class="label">Tên</span><span class="value">${tenant.name}</span></div>
            <div class="detail-row"><span class="label">SĐT</span><span class="value"><a href="tel:${tenant.phone}">${tenant.phone || '—'}</a></span></div>
            <div class="detail-row"><span class="label">CCCD/CMND</span><span class="value">${tenant.idNumber || '—'}</span></div>
        </div>
        <div class="detail-section">
            <h3>Hợp đồng</h3>
            <div class="detail-row"><span class="label">Phòng</span><span class="value">${roomName}</span></div>
            <div class="detail-row"><span class="label">Ngày bắt đầu</span><span class="value">${formatDate(tenant.contractStart)}</span></div>
            <div class="detail-row"><span class="label">Ngày kết thúc</span><span class="value">${formatDate(tenant.contractEnd)}</span></div>
            <div class="detail-row"><span class="label">Trạng thái</span><span class="value"><span class="contract-status ${contract.cls}">${contract.text}</span></span></div>
        </div>
        <div class="detail-actions">
            <button class="btn btn-primary" onclick="showTenantForm('${tenant.id}')">Sửa</button>
            <button class="btn btn-danger" onclick="confirmDeleteTenant('${tenant.id}')">Xóa</button>
        </div>
    `);
}

// ===== Tenant Form =====
async function showTenantForm(tenantId, preselectedRoomId) {
    let tenant = { name: '', phone: '', idNumber: '', roomId: preselectedRoomId || '', contractStart: '', contractEnd: '' };
    if (tenantId) {
        tenant = await db.getTenant(tenantId) || tenant;
    }

    const rooms = await db.getAllRooms();
    const roomOptions = rooms.map(r =>
        `<option value="${r.id}" ${tenant.roomId === r.id ? 'selected' : ''}>${r.name}</option>`
    ).join('');

    openModal(tenantId ? 'Sửa người thuê' : 'Thêm người thuê', `
        <form id="tenant-form">
            <div class="form-group">
                <label>Họ tên *</label>
                <input type="text" id="f-tenant-name" value="${tenant.name}" required placeholder="VD: Nguyễn Văn A">
            </div>
            <div class="form-group">
                <label>Số điện thoại</label>
                <input type="tel" id="f-tenant-phone" value="${tenant.phone || ''}" placeholder="VD: 0901234567">
            </div>
            <div class="form-group">
                <label>CCCD/CMND</label>
                <input type="text" id="f-tenant-id" value="${tenant.idNumber || ''}" placeholder="VD: 079123456789">
            </div>
            <div class="form-group">
                <label>Phòng</label>
                <select id="f-tenant-room">
                    <option value="">-- Chọn phòng --</option>
                    ${roomOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Ngày bắt đầu HĐ</label>
                <input type="date" id="f-tenant-start" value="${tenant.contractStart || ''}">
            </div>
            <div class="form-group">
                <label>Ngày kết thúc HĐ</label>
                <input type="date" id="f-tenant-end" value="${tenant.contractEnd || ''}">
            </div>
            <button type="submit" class="btn btn-primary">Lưu</button>
        </form>
    `);

    $('#tenant-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            ...tenant,
            name: $('#f-tenant-name').value.trim(),
            phone: $('#f-tenant-phone').value.trim(),
            idNumber: $('#f-tenant-id').value.trim(),
            roomId: $('#f-tenant-room').value || null,
            contractStart: $('#f-tenant-start').value || null,
            contractEnd: $('#f-tenant-end').value || null
        };
        if (!data.name) return;

        await db.saveTenant(data);

        // Auto-update room status
        if (data.roomId) {
            const room = await db.getRoom(data.roomId);
            if (room) {
                room.status = 'occupied';
                await db.saveRoom(room);
            }
        }

        speak('Đã lưu người thuê ' + data.name, 'Tenant ' + data.name + ' saved');
        closeModal();
        renderPage();
    });
}

// ===== Delete Tenant =====
async function confirmDeleteTenant(tenantId) {
    const tenant = await db.getTenant(tenantId);
    if (!tenant) return;

    openModal('Xác nhận xóa', `
        <p style="margin-bottom:16px">Bạn có chắc muốn xóa người thuê <strong>${tenant.name}</strong>?</p>
        <button class="btn btn-danger" onclick="deleteTenant('${tenantId}')">Xóa</button>
        <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    `);
}

async function deleteTenant(tenantId) {
    const tenant = await db.getTenant(tenantId);

    // Update room status to vacant if tenant had a room
    if (tenant && tenant.roomId) {
        const room = await db.getRoom(tenant.roomId);
        if (room) {
            const remainingTenants = await db.getTenantsByRoom(tenant.roomId);
            if (remainingTenants.length <= 1) {
                room.status = 'vacant';
                await db.saveRoom(room);
            }
        }
    }

    await db.deleteTenant(tenantId);
    speak('Đã xóa người thuê', 'Tenant deleted');
    closeModal();
    renderPage();
}

// ===== Electric Meter Page =====
async function renderElectricPage() {
    const rooms = await db.getAllRooms();
    const meters = await db.getAllMeters();
    const billMonth = getBillMonth();
    const currentMonth = `${billMonth.month}/${billMonth.year}`;

    // Build meter map: roomId -> sorted meters (newest first)
    const meterMap = {};
    meters.forEach(m => {
        if (!meterMap[m.roomId]) meterMap[m.roomId] = [];
        meterMap[m.roomId].push(m);
    });
    Object.values(meterMap).forEach(arr => arr.sort((a, b) => {
        const [am, ay] = a.month.split('/').map(Number);
        const [bm, by] = b.month.split('/').map(Number);
        return by !== ay ? by - ay : bm - am;
    }));

    const sortedRooms = rooms.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));

    mainContent.innerHTML = `
        <div class="electric-page">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p style="color:var(--text-secondary)">Tháng: <strong>${currentMonth}</strong></p>
                <button class="btn-bill btn-export" id="btn-export-electric" style="flex:none;padding:6px 14px;font-size:0.9rem">Xuất file</button>
            </div>
            ${sortedRooms.length === 0 ? '<p style="text-align:center;color:var(--text-secondary)">Chưa có phòng nào</p>' :
            sortedRooms.map(room => {
                const roomMeters = meterMap[room.id] || [];
                const currentMeter = roomMeters.find(m => m.month === currentMonth);
                const prevMeter = roomMeters.find(m => m.month !== currentMonth);
                const oldVal = currentMeter ? currentMeter.oldValue : (prevMeter ? prevMeter.newValue : '');
                const newVal = currentMeter ? currentMeter.newValue : '';
                const kwh = (oldVal !== '' && newVal !== '') ? Math.max(0, Number(newVal) - Number(oldVal)) : null;
                const ppl = room.people || 0;

                return `
                <div class="electric-card">
                    <div class="electric-card-header">
                        <span class="room-name">${room.name}</span>
                        <div style="display:flex;gap:6px">
                            ${ppl > 0 ? `<span class="electric-kwh" style="background:rgba(52,152,219,0.15);color:#3498db">${ppl} người</span>` : ''}
                            ${kwh !== null ? `<span class="electric-kwh">${kwh} kWh</span>` : ''}
                        </div>
                    </div>
                    <div class="electric-inputs">
                        <div class="form-group" style="flex:1;margin:0">
                            <label>Số người</label>
                            <input type="number" class="elec-people" data-room="${room.id}" value="${ppl || ''}" min="0" placeholder="0">
                        </div>
                        <div class="form-group" style="flex:1;margin:0">
                            <label>Số cũ</label>
                            <input type="number" class="elec-old" data-room="${room.id}" value="${oldVal}" placeholder="Kỳ trước">
                        </div>
                        <div class="form-group" style="flex:1;margin:0">
                            <label>Số mới</label>
                            <input type="number" class="elec-new" data-room="${room.id}" value="${newVal}" placeholder="Kỳ này">
                        </div>
                        <button class="btn-save-meter" data-room="${room.id}" title="Lưu">✓</button>
                    </div>
                    ${roomMeters.length > 0 ? `
                    <div class="electric-history">
                        ${roomMeters.slice(0, 6).map(m => {
                            const used = (m.oldValue !== '' && m.newValue !== '') ? Math.max(0, Number(m.newValue) - Number(m.oldValue)) : '—';
                            return `<div class="history-row">
                                <span>T${m.month}</span>
                                <span>${m.oldValue ?? '—'} → ${m.newValue ?? '—'}</span>
                                <span>${used !== '—' ? used + ' kWh' : '—'}</span>
                            </div>`;
                        }).join('')}
                    </div>` : ''}
                </div>`;
            }).join('')}
        </div>`;

    // Save handlers
    document.querySelectorAll('.btn-save-meter').forEach(btn => {
        btn.addEventListener('click', async () => {
            const roomId = btn.dataset.room;
            const card = btn.closest('.electric-card');
            const oldValue = card.querySelector('.elec-old').value;
            const newValue = card.querySelector('.elec-new').value;
            const peopleValue = card.querySelector('.elec-people').value;

            // Save meter reading
            const roomMeters = await db.getMetersByRoom(roomId);
            let meter = roomMeters.find(m => m.month === currentMonth);
            if (oldValue !== '' || newValue !== '') {
                if (!meter) meter = { roomId, month: currentMonth };
                meter.oldValue = oldValue !== '' ? Number(oldValue) : '';
                meter.newValue = newValue !== '' ? Number(newValue) : '';
                await db.saveMeter(meter);
            }

            // Save people count + sync electric to room
            const room = await db.getRoom(roomId);
            if (room) {
                room.people = peopleValue !== '' ? Number(peopleValue) : 0;
                room.electricOld = oldValue !== '' ? Number(oldValue) : '';
                room.electricNew = newValue !== '' ? Number(newValue) : '';
                await db.saveRoom(room);
            }

            showToast('Đã lưu');
            renderElectricPage();
        });
    });

    // Export electric meters as HTML table (full year)
    document.getElementById('btn-export-electric')?.addEventListener('click', () => {
        exportElectricTable(sortedRooms, meterMap, billMonth);
    });
}

function exportElectricTable(sortedRooms, meterMap, billMonth) {
    const year = billMonth.year;
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(`${m}/${year}`);

    // Build data rows
    const dataRows = sortedRooms.map(room => {
        const roomMeters = meterMap[room.id] || [];
        const readings = months.map(month => {
            const meter = roomMeters.find(m => m.month === month);
            return meter && meter.oldValue !== '' ? Number(meter.oldValue) : null;
        });
        const lastMeterWithNew = roomMeters.find(m => m.newValue !== '' && m.newValue != null);
        const lastMonthIdx = lastMeterWithNew ? months.indexOf(lastMeterWithNew.month) : -1;
        if (lastMonthIdx >= 0 && lastMonthIdx + 1 < 12 && readings[lastMonthIdx + 1] === null) {
            readings[lastMonthIdx + 1] = Number(lastMeterWithNew.newValue);
        }
        let totalKwh = 0;
        const cells = months.map((_, i) => {
            const val = readings[i];
            const prev = i > 0 ? readings[i - 1] : null;
            const kwh = (val !== null && prev !== null) ? Math.max(0, val - prev) : null;
            if (kwh !== null) totalKwh += kwh;
            return { val, kwh };
        });
        return { name: room.name, cells, totalKwh };
    });

    // Canvas table drawing
    const colW = 70, rowH = 48, nameW = 100, totalW = 70;
    const cols = months.length;
    const headerH = 36;
    const titleH = 50;
    const W = nameW + cols * colW + totalW + 2;
    const H = titleH + headerH + dataRows.length * rowH + 2;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#333'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`⚡ Bảng số điện năm ${year}`, W / 2, 32);

    const startY = titleH;
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';

    // Header
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, startY, W, headerH);
    ctx.fillStyle = '#fff';
    ctx.fillText('Phòng', nameW / 2, startY + 22);
    for (let i = 0; i < cols; i++) ctx.fillText('T' + (i + 1), nameW + i * colW + colW / 2, startY + 22);
    ctx.fillText('Tổng', nameW + cols * colW + totalW / 2, startY + 22);

    // Rows
    dataRows.forEach((row, ri) => {
        const y = startY + headerH + ri * rowH;
        ctx.fillStyle = ri % 2 === 0 ? '#f8f8f8' : '#fff';
        ctx.fillRect(0, y, W, rowH);

        // Room name
        ctx.fillStyle = '#222'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'left';
        ctx.fillText(row.name, 8, y + 20);

        // Month cells
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

        // Total
        if (row.totalKwh > 0) {
            ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
            ctx.fillText(String(row.totalKwh), nameW + cols * colW + totalW / 2, y + 26);
        }
    });

    // Grid lines
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= dataRows.length; i++) {
        const y = startY + headerH + i * rowH;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let i = 0; i <= cols + 2; i++) {
        const x = i === 0 ? 0 : i === 1 ? nameW : i <= cols + 1 ? nameW + (i - 1) * colW : W;
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, H); ctx.stroke();
    }

    downloadCanvasPng(canvas, `so-dien-${year}.png`);
    showToast('Đã tải ảnh bảng số điện');
}

// ===== Calculate All Bills =====
async function calculateAllBills() {
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
        const currentMeter = roomMeters.find(m => m.month === currentMonth);
        const elecOld = currentMeter ? currentMeter.oldValue : (room.electricOld ?? '');
        const elecNew = currentMeter ? currentMeter.newValue : (room.electricNew ?? '');
        const kwh = (elecOld !== '' && elecNew !== '') ? Math.max(0, Number(elecNew) - Number(elecOld)) : 0;

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

    showToast(`Đã tính tiền ${count} phòng`);
    renderPage();
}

// ===== Export All Bills =====
async function exportAllBills() {
    const rooms = await db.getAllRooms();
    const tenants = await db.getAllTenants();
    const tenantMap = {};
    tenants.forEach(t => { if (t.roomId) tenantMap[t.roomId] = t; });

    const billRooms = rooms.filter(r => r.lastBill).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    if (billRooms.length === 0) {
        showToast('Chưa có phòng nào đã tính tiền');
        return;
    }

    const fmtShort = (n) => {
        n = Number(n);
        if (n >= 1000) { const k = n / 1000; return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K'; }
        return String(n);
    };
    const headers = ['Phòng', 'Người thuê', 'Phòng', 'Nước', 'Điện', 'Tổng'];
    const colWidths = [110, 90, 65, 55, 55, 75];
    const rowH = 36, headerH = 36, titleH = 50;
    const W = colWidths.reduce((a, b) => a + b, 0) + 2;
    const H = titleH + headerH + billRooms.length * rowH + rowH + 2; // +1 for total row

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#333'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText('💰 Tổng hợp tiền phòng', W / 2, 32);

    const startY = titleH;

    // Header
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, startY, W, headerH);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial';
    let hx = 0;
    headers.forEach((h, i) => {
        ctx.textAlign = i < 2 ? 'left' : 'right';
        const tx = i < 2 ? hx + 8 : hx + colWidths[i] - 8;
        ctx.fillText(h, tx, startY + 22);
        hx += colWidths[i];
    });

    // Data rows
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
            tenant ? tenant.name : '—',
            fmtShort(roomCost),
            d.waterCost !== undefined ? fmtShort(d.waterCost) : '—',
            d.electricCost !== undefined ? fmtShort(d.electricCost) : '—',
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

    // Total row
    const ty = startY + headerH + billRooms.length * rowH;
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, ty, W, rowH);
    ctx.fillStyle = '#222'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'left';
    ctx.fillText('TỔNG CỘNG', 8, ty + 22);
    ctx.fillStyle = '#e94560'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'right';
    ctx.fillText(fmtShort(grandTotal), W - 8, ty + 22);

    // Grid lines
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
    showToast('Đã tải ảnh tổng hợp');
}

function downloadCanvasPng(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function shareOrCopy(text, toastMsg) {
    if (navigator.share) {
        navigator.share({ text }).catch(e => {
            if (e.name !== 'AbortError') copyToClipboard(text, toastMsg);
        });
    } else {
        copyToClipboard(text, toastMsg);
    }
}

// ===== Settings Page =====
async function renderSettingsPage() {
    const electricPrice = await db.getSetting('electricPrice') || '';
    const waterPrice = await db.getSetting('waterPrice') || '';

    mainContent.innerHTML = `
        <div class="backup-section">
            <h3>Giọng nói</h3>
            <div class="form-group toggle-group">
                <label>Bật giọng nói</label>
                <label class="toggle">
                    <input type="checkbox" id="f-voice-toggle" ${voiceEnabled ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <button type="button" id="btn-test-voice" class="btn btn-secondary" style="margin-top:12px">Test giọng nói</button>
            <p id="voice-status" style="font-size:0.85rem;color:var(--text-secondary);margin-top:8px"></p>
        </div>
        <div class="backup-section">
            <h3>Giá điện / nước</h3>
            <form id="settings-form">
                <div class="form-group">
                    <label>Giá điện (đ/kWh)</label>
                    <input type="number" id="f-electric-price" value="${electricPrice}" placeholder="VD: 3500">
                </div>
                <div class="form-group">
                    <label>Giá nước (1000đ/người)</label>
                    <input type="number" id="f-water-price" value="${waterPrice}" placeholder="VD: 100">
                </div>
                <button type="submit" class="btn btn-primary">Lưu cài đặt</button>
            </form>
        </div>
    `;

    // Show voice info
    const updateVoiceStatus = () => {
        if (cachedVoices.length === 0) cachedVoices = speechSynthesis.getVoices();
        const viVoice = cachedVoices.find(v => v.lang.startsWith('vi'));
        const status = $('#voice-status');
        if (status) {
            status.textContent = viVoice
                ? 'Giọng Việt: ' + viVoice.name
                : 'Không tìm thấy giọng Việt. Sẽ dùng tiếng Anh.';
        }
    };
    updateVoiceStatus();

    $('#f-voice-toggle').addEventListener('change', async (e) => {
        voiceEnabled = e.target.checked;
        await db.saveSetting('voiceEnabled', voiceEnabled);
        if (voiceEnabled) {
            speak('Đã bật giọng nói', 'Voice enabled');
        }
    });

    $('#btn-test-voice').addEventListener('click', () => {
        updateVoiceStatus();
        const wasEnabled = voiceEnabled;
        voiceEnabled = true;
        speak('Xin chào, đây là giọng nói của ứng dụng', 'Hello, this is the app voice');
        voiceEnabled = wasEnabled;
    });

    $('#settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await db.saveSetting('electricPrice', $('#f-electric-price').value ? Number($('#f-electric-price').value) : null);
        await db.saveSetting('waterPrice', $('#f-water-price').value ? Number($('#f-water-price').value) : null);
        speak('Đã lưu cài đặt', 'Settings saved');
        showToast('Đã lưu cài đặt!');
    });
}

// ===== Backup Page =====
function renderBackupPage() {
    mainContent.innerHTML = `
        <div class="backup-section">
            <h3>Sao lưu dữ liệu</h3>
            <p>Tải xuống toàn bộ dữ liệu dưới dạng file JSON. Lưu file này để khôi phục khi cần.</p>
            <button class="btn btn-primary" onclick="exportData()">Tải xuống bản sao lưu</button>
        </div>
        <div class="backup-section">
            <h3>Khôi phục dữ liệu</h3>
            <p>Tải lên file JSON sao lưu trước đó. <strong style="color:var(--danger)">Dữ liệu hiện tại sẽ bị ghi đè.</strong></p>
            <input type="file" id="import-file" accept=".json" style="display:none">
            <button class="btn btn-secondary" onclick="document.getElementById('import-file').click()">Chọn file để khôi phục</button>
        </div>
    `;

    // Attach import handler
    setTimeout(() => {
        const fileInput = document.getElementById('import-file');
        if (fileInput) {
            fileInput.addEventListener('change', importData);
        }
    }, 100);
}

async function exportData() {
    const backup = await db.exportAll();
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentmgr-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    speak('Đã tải xuống bản sao lưu', 'Backup downloaded');
}

// ===== Export Bill Image =====
function exportBillImage({ roomName, month, people, kwh, roomCost, waterCost, electricCost, total, electricPriceVal, waterPriceVal }) {
    const fmt = (n) => Number(n).toLocaleString('vi-VN') + 'đ';
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 500);

    ctx.fillStyle = '#333';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HÓA ĐƠN TIỀN NHÀ', 400, 60);

    ctx.font = '18px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText(`${roomName}  —  Tháng ${month}`, 400, 95);

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 115); ctx.lineTo(760, 115); ctx.stroke();

    const rows = [
        [`Tiền phòng`, fmt(roomCost)],
        [`Tiền nước (${people} người × ${fmt(waterPriceVal * 1000)})`, fmt(waterCost)],
        [`Tiền điện (${kwh} kWh × ${fmt(electricPriceVal)})`, fmt(electricCost)],
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
    ctx.fillText('TỔNG CỘNG', 60, y + 50);
    ctx.textAlign = 'right'; ctx.font = 'bold 28px Arial';
    ctx.fillText(fmt(total), 740, y + 50);

    const link = document.createElement('a');
    link.download = `hoadon-${roomName}-T${month.replace('/', '-')}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
        const backup = JSON.parse(text);
        if (!backup.data || !backup.data.rooms) {
            showToast('File không hợp lệ!');
            return;
        }
        await db.importAll(backup);
        speak('Khôi phục thành công', 'Restore completed');
        showToast('Khôi phục thành công!');
        renderPage();
    } catch (e) {
        showToast('Lỗi đọc file: ' + e.message);
    }
}
