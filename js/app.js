// ===== App State =====
let currentPage = 'rooms';
let searchQuery = '';

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

    // FAB
    fab.addEventListener('click', () => {
        if (currentPage === 'rooms') showRoomForm();
        else if (currentPage === 'tenants') showTenantForm();
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
    return Number(amount).toLocaleString('vi-VN') + 'đ';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
}

function getContractStatus(endDate) {
    if (!endDate) return { text: 'Không có HĐ', cls: '' };
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
                   (r.floor && r.floor.toString().includes(searchQuery)) ||
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

    mainContent.innerHTML = `<div class="room-list">${filtered.map(room => {
        const tenant = tenantMap[room.id];
        const status = room.status || 'vacant';
        let tenantHTML = '';
        if (tenant) {
            const contract = getContractStatus(tenant.contractEnd);
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
                    ${room.floor ? `<span>Tầng ${room.floor}</span>` : ''}
                    <span>${formatCurrency(room.price)}/tháng</span>
                </div>
                ${tenantHTML}
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
        const contract = getContractStatus(tenant.contractEnd);
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
            <div class="detail-row"><span class="label">Tầng</span><span class="value">${room.floor || '—'}</span></div>
            <div class="detail-row"><span class="label">Giá thuê</span><span class="value">${formatCurrency(room.price)}/tháng</span></div>
            <div class="detail-row"><span class="label">Trạng thái</span><span class="value">${room.status === 'occupied' ? 'Đang thuê' : 'Trống'}</span></div>
        </div>
        <div class="detail-section">
            <h3>Người thuê</h3>
            ${tenantHTML}
        </div>
        <div class="detail-actions">
            <button class="btn btn-primary" onclick="showRoomForm('${room.id}')">Sửa</button>
            <button class="btn btn-danger" onclick="confirmDeleteRoom('${room.id}')">Xóa</button>
        </div>
        ${tenant ? `<button class="btn btn-secondary" onclick="showTenantForm('${tenant.id}')">Sửa người thuê</button>` :
                    `<button class="btn btn-secondary" onclick="showTenantForm(null, '${room.id}')">Thêm người thuê</button>`}
    `);
}

// ===== Room Form =====
async function showRoomForm(roomId) {
    let room = { name: '', floor: '', price: '', status: 'vacant' };
    if (roomId) {
        room = await db.getRoom(roomId) || room;
    }

    openModal(roomId ? 'Sửa phòng' : 'Thêm phòng', `
        <form id="room-form">
            <div class="form-group">
                <label>Tên/Số phòng *</label>
                <input type="text" id="f-room-name" value="${room.name}" required placeholder="VD: Phòng 101">
            </div>
            <div class="form-group">
                <label>Tầng</label>
                <input type="number" id="f-room-floor" value="${room.floor || ''}" placeholder="VD: 1">
            </div>
            <div class="form-group">
                <label>Giá thuê (VNĐ/tháng)</label>
                <input type="number" id="f-room-price" value="${room.price || ''}" placeholder="VD: 3000000">
            </div>
            <div class="form-group">
                <label>Trạng thái</label>
                <select id="f-room-status">
                    <option value="vacant" ${room.status === 'vacant' ? 'selected' : ''}>Trống</option>
                    <option value="occupied" ${room.status === 'occupied' ? 'selected' : ''}>Đang thuê</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary">Lưu</button>
        </form>
    `);

    $('#room-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            ...room,
            name: $('#f-room-name').value.trim(),
            floor: $('#f-room-floor').value ? Number($('#f-room-floor').value) : null,
            price: $('#f-room-price').value ? Number($('#f-room-price').value) : null,
            status: $('#f-room-status').value
        };
        if (!data.name) return;
        await db.saveRoom(data);
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
        const contract = getContractStatus(t.contractEnd);
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

    const contract = getContractStatus(tenant.contractEnd);

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
    closeModal();
    renderPage();
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
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
        const backup = JSON.parse(text);
        if (!backup.data || !backup.data.rooms) {
            alert('File không hợp lệ!');
            return;
        }
        await db.importAll(backup);
        alert('Khôi phục thành công!');
        renderPage();
    } catch (e) {
        alert('Lỗi đọc file: ' + e.message);
    }
}
