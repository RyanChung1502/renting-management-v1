import db from '../db.js';
import state from '../state.js';
import { $, formatCurrency, formatDate, getContractStatus } from '../helpers.js';
import { speak } from '../voice.js';
import { openModal, closeModal } from '../ui.js';
import { showBillForm, exportBill, calculateAllBills } from '../billing.js';
import { exportAllBills } from '../canvas-export.js';

export async function renderRoomList() {
    const mainContent = $('#main-content');
    const rooms = await db.getAllRooms();
    const tenants = await db.getAllTenants();

    const tenantMap = {};
    tenants.forEach(t => {
        if (t.roomId) tenantMap[t.roomId] = t;
    });

    let filtered = rooms;
    if (state.searchQuery) {
        filtered = rooms.filter(r => {
            const tenant = tenantMap[r.id];
            return r.name.toLowerCase().includes(state.searchQuery) ||
                   (tenant && tenant.name.toLowerCase().includes(state.searchQuery));
        });
    }

    filtered.sort((a, b) => {
        if (a.status === b.status) return a.name.localeCompare(b.name);
        return a.status === 'occupied' ? -1 : 1;
    });

    if (filtered.length === 0) {
        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="emoji">\ud83c\udfe0</div>
                <p>${state.searchQuery ? 'Kh\u00f4ng t\u00ecm th\u1ea5y ph\u00f2ng n\u00e0o' : 'Ch\u01b0a c\u00f3 ph\u00f2ng n\u00e0o'}</p>
                <p style="margin-top:8px;font-size:0.85rem">Nh\u1ea5n n\u00fat + \u0111\u1ec3 th\u00eam ph\u00f2ng m\u1edbi</p>
            </div>`;
        return;
    }

    mainContent.innerHTML = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px;padding:0 4px">
        <button class="btn-bill" id="btn-calc-all" style="flex:none;padding:6px 14px;font-size:0.9rem">T\u00ednh t\u1ea5t c\u1ea3</button>
        <button class="btn-bill btn-export" id="btn-export-all" style="flex:none;padding:6px 14px;font-size:0.9rem">Xu\u1ea5t t\u1ed5ng h\u1ee3p</button>
    </div><div class="room-list">${filtered.map(room => {
        const tenant = tenantMap[room.id];
        const status = room.status || 'vacant';
        let tenantHTML = '';
        if (tenant) {
            const contract = getContractStatus(tenant.contractEnd, tenant.contractStart);
            tenantHTML = `
                <div class="room-tenant">
                    \ud83d\udc64 ${tenant.name}${tenant.phone ? ' \u00b7 ' + tenant.phone : ''}
                    ${contract.cls ? `<span class="contract-status ${contract.cls}">${contract.text}</span>` : ''}
                </div>`;
        }
        return `
            <div class="room-card ${status}" data-room-id="${room.id}">
                <div class="room-card-header">
                    <span class="room-name">${room.name}</span>
                    <span class="room-status ${status}">${status === 'occupied' ? '\u0110ang thu\u00ea' : 'Tr\u1ed1ng'}</span>
                </div>
                <div class="room-info">
                    <span>${formatCurrency(room.price)}/th\u00e1ng</span>
                    <span>T\u1ed5ng: ${room.lastBill ? Number(room.lastBill).toLocaleString('vi-VN') + '\u0111' : '0\u0111'}</span>
                </div>
                ${tenantHTML}
                ${status === 'occupied' ? `<div class="room-card-actions">
                    <button class="btn-bill btn-bill-calc" data-room-id="${room.id}">T\u00ednh ti\u1ec1n</button>
                    ${room.lastBill ? `<button class="btn-bill btn-export btn-bill-export" data-room-id="${room.id}">Xu\u1ea5t g\u1eedi</button>` : ''}
                </div>` : ''}
            </div>`;
    }).join('')}</div>`;

    // Event delegation
    document.getElementById('btn-calc-all')?.addEventListener('click', () => calculateAllBills());
    document.getElementById('btn-export-all')?.addEventListener('click', () => exportAllBills());

    mainContent.querySelectorAll('.room-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.room-card-actions')) return;
            showRoomDetail(card.dataset.roomId);
        });
    });
    mainContent.querySelectorAll('.btn-bill-calc').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); showBillForm(btn.dataset.roomId); });
    });
    mainContent.querySelectorAll('.btn-bill-export').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); exportBill(btn.dataset.roomId); });
    });
}

async function showRoomDetail(roomId) {
    const room = await db.getRoom(roomId);
    if (!room) return;

    const tenants = await db.getTenantsByRoom(roomId);
    const tenant = tenants[0];

    let tenantHTML = '<p style="color:var(--text-secondary)">Ch\u01b0a c\u00f3 ng\u01b0\u1eddi thu\u00ea</p>';
    if (tenant) {
        const contract = getContractStatus(tenant.contractEnd, tenant.contractStart);
        tenantHTML = `
            <div class="detail-row"><span class="label">T\u00ean</span><span class="value">${tenant.name}</span></div>
            <div class="detail-row"><span class="label">S\u0110T</span><span class="value"><a href="tel:${tenant.phone}">${tenant.phone || '\u2014'}</a></span></div>
            <div class="detail-row"><span class="label">CCCD/CMND</span><span class="value">${tenant.idNumber || '\u2014'}</span></div>
            <div class="detail-row"><span class="label">Ng\u00e0y b\u1eaft \u0111\u1ea7u</span><span class="value">${formatDate(tenant.contractStart)}</span></div>
            <div class="detail-row"><span class="label">Ng\u00e0y k\u1ebft th\u00fac</span><span class="value">${formatDate(tenant.contractEnd)}</span></div>
            <div class="detail-row"><span class="label">H\u1ee3p \u0111\u1ed3ng</span><span class="value"><span class="contract-status ${contract.cls}">${contract.text}</span></span></div>`;
    }

    openModal(room.name, `
        <div class="detail-section">
            <h3>Th\u00f4ng tin ph\u00f2ng</h3>
            <div class="detail-row"><span class="label">T\u00ean ph\u00f2ng</span><span class="value">${room.name}</span></div>
            <div class="detail-row"><span class="label">Gi\u00e1 thu\u00ea</span><span class="value">${formatCurrency(room.price)}/th\u00e1ng</span></div>
            <div class="detail-row"><span class="label">\u0110\u1eb7t c\u1ecdc</span><span class="value">${formatCurrency(room.deposit)}</span></div>
            <div class="detail-row"><span class="label">Tr\u1ea1ng th\u00e1i</span><span class="value">${room.status === 'occupied' ? '\u0110ang thu\u00ea' : 'Tr\u1ed1ng'}</span></div>
            <div class="detail-row"><span class="label">Ti\u1ec1n ph\u00f2ng th\u00e1ng n\u00e0y</span><span class="value" style="color:var(--accent-light)">${room.lastBill ? Number(room.lastBill).toLocaleString('vi-VN') + '\u0111' : '0\u0111'}${room.lastBillMonth ? ' (T' + room.lastBillMonth + ')' : ''}</span></div>
        </div>
        <div class="detail-section">
            <h3>Ng\u01b0\u1eddi thu\u00ea</h3>
            ${tenantHTML}
        </div>
        ${room.status === 'occupied' ? `<button class="btn btn-primary" id="btn-detail-bill" style="margin-bottom:8px">T\u00ednh ti\u1ec1n</button>` : ''}
        <div class="detail-actions">
            <button class="btn btn-secondary" id="btn-edit-room">S\u1eeda</button>
            <button class="btn btn-danger" id="btn-delete-room">X\u00f3a</button>
        </div>
        ${tenant ? `<button class="btn btn-secondary" id="btn-edit-tenant">S\u1eeda ng\u01b0\u1eddi thu\u00ea</button>` :
                    `<button class="btn btn-secondary" id="btn-add-tenant">Th\u00eam ng\u01b0\u1eddi thu\u00ea</button>`}
    `);

    document.getElementById('btn-detail-bill')?.addEventListener('click', () => showBillForm(room.id));
    document.getElementById('btn-edit-room')?.addEventListener('click', () => showRoomForm(room.id));
    document.getElementById('btn-delete-room')?.addEventListener('click', () => confirmDeleteRoom(room.id));
    if (tenant) {
        document.getElementById('btn-edit-tenant')?.addEventListener('click', () => {
            // Import dynamically to avoid circular dependency
            import('./tenants.js').then(m => m.showTenantForm(tenant.id));
        });
    } else {
        document.getElementById('btn-add-tenant')?.addEventListener('click', () => {
            import('./tenants.js').then(m => m.showTenantForm(null, room.id));
        });
    }
}

export async function showRoomForm(roomId) {
    let room = { name: '', price: '', deposit: '', status: 'vacant' };
    let existingTenant = null;
    if (roomId) {
        room = await db.getRoom(roomId) || room;
        const tenants = await db.getTenantsByRoom(roomId);
        existingTenant = tenants[0] || null;
    }

    openModal(roomId ? 'S\u1eeda ph\u00f2ng' : 'Th\u00eam ph\u00f2ng', `
        <form id="room-form">
            <div class="form-group">
                <label>T\u00ean/S\u1ed1 ph\u00f2ng *</label>
                <input type="text" id="f-room-name" value="${room.name}" required placeholder="VD: Ph\u00f2ng 101">
            </div>
            <div class="form-group">
                <label>Gi\u00e1 thu\u00ea (1000\u0111/th\u00e1ng)</label>
                <input type="number" id="f-room-price" value="${room.price || ''}" placeholder="VD: 3000">
            </div>
            <div class="form-group">
                <label>Ti\u1ec1n \u0111\u1eb7t c\u1ecdc (1000\u0111)</label>
                <input type="number" id="f-room-deposit" value="${room.deposit || ''}" placeholder="VD: 3000">
            </div>
            <div class="form-group">
                <label>T\u00ean kh\u00e1ch thu\u00ea</label>
                <input type="text" id="f-room-tenant" value="${existingTenant ? existingTenant.name : ''}" placeholder="VD: Nguy\u1ec5n V\u0103n A">
            </div>
            <button type="submit" class="btn btn-primary">L\u01b0u</button>
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
            status: tenantName ? 'occupied' : 'vacant'
        };
        if (!data.name) return;
        await db.saveRoom(data);

        if (tenantName) {
            const tenantData = existingTenant || { roomId: data.id };
            tenantData.name = tenantName;
            tenantData.roomId = data.id;
            await db.saveTenant(tenantData);
        } else if (existingTenant) {
            await db.deleteTenant(existingTenant.id);
        }

        speak('\u0110\u00e3 l\u01b0u ph\u00f2ng ' + data.name, 'Room ' + data.name + ' saved');
        showToast('\u0110\u00e3 l\u01b0u ' + data.name);
        closeModal();
        state.renderPage();
    });
}

async function confirmDeleteRoom(roomId) {
    const room = await db.getRoom(roomId);
    if (!room) return;

    openModal('X\u00e1c nh\u1eadn x\u00f3a', `
        <p style="margin-bottom:16px">B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a <strong>${room.name}</strong>?<br>
        <span style="color:var(--danger);font-size:0.9rem">Ng\u01b0\u1eddi thu\u00ea li\u00ean k\u1ebft c\u0169ng s\u1ebd b\u1ecb x\u00f3a.</span></p>
        <button class="btn btn-danger" id="btn-confirm-delete">X\u00f3a</button>
        <button class="btn btn-secondary" id="btn-cancel-delete">H\u1ee7y</button>
    `);

    document.getElementById('btn-confirm-delete').addEventListener('click', () => deleteRoom(roomId));
    document.getElementById('btn-cancel-delete').addEventListener('click', () => closeModal());
}

async function deleteRoom(roomId) {
    await db.deleteRoom(roomId);
    speak('\u0110\u00e3 x\u00f3a ph\u00f2ng', 'Room deleted');
    closeModal();
    state.renderPage();
}
