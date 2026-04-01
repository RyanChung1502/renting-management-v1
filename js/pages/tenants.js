import db from '../db.js';
import state from '../state.js';
import { $, formatDate, getContractStatus } from '../helpers.js';
import { speak } from '../voice.js';
import { openModal, closeModal } from '../ui.js';

export async function renderTenantList() {
    const mainContent = $('#main-content');
    const tenants = await db.getAllTenants();
    const rooms = await db.getAllRooms();

    const roomMap = {};
    rooms.forEach(r => { roomMap[r.id] = r; });

    let filtered = tenants;
    if (state.searchQuery) {
        filtered = tenants.filter(t =>
            t.name.toLowerCase().includes(state.searchQuery) ||
            (t.phone && t.phone.includes(state.searchQuery)) ||
            (t.roomId && roomMap[t.roomId] && roomMap[t.roomId].name.toLowerCase().includes(state.searchQuery))
        );
    }

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="emoji">\ud83d\udc64</div>
                <p>${state.searchQuery ? 'Kh\u00f4ng t\u00ecm th\u1ea5y ng\u01b0\u1eddi thu\u00ea' : 'Ch\u01b0a c\u00f3 ng\u01b0\u1eddi thu\u00ea n\u00e0o'}</p>
                <p style="margin-top:8px;font-size:0.85rem">Nh\u1ea5n n\u00fat + \u0111\u1ec3 th\u00eam ng\u01b0\u1eddi thu\u00ea</p>
            </div>`;
        return;
    }

    mainContent.innerHTML = `<div class="tenant-list">${filtered.map(t => {
        const room = roomMap[t.roomId];
        const contract = getContractStatus(t.contractEnd, t.contractStart);
        return `
            <div class="tenant-card" data-tenant-id="${t.id}">
                <div class="tenant-name">${t.name}</div>
                <div class="tenant-phone">${t.phone || 'Ch\u01b0a c\u00f3 S\u0110T'}</div>
                ${room ? `<div class="tenant-room">\ud83c\udfe0 ${room.name}</div>` : ''}
                ${contract.cls ? `<span class="contract-status ${contract.cls}">${contract.text}</span>` : ''}
            </div>`;
    }).join('')}</div>`;

    mainContent.querySelectorAll('.tenant-card').forEach(card => {
        card.addEventListener('click', () => showTenantDetail(card.dataset.tenantId));
    });
}

async function showTenantDetail(tenantId) {
    const tenant = await db.getTenant(tenantId);
    if (!tenant) return;

    let roomName = '\u2014';
    if (tenant.roomId) {
        const room = await db.getRoom(tenant.roomId);
        if (room) roomName = room.name;
    }

    const contract = getContractStatus(tenant.contractEnd, tenant.contractStart);

    openModal(tenant.name, `
        <div class="detail-section">
            <h3>Th\u00f4ng tin c\u00e1 nh\u00e2n</h3>
            <div class="detail-row"><span class="label">T\u00ean</span><span class="value">${tenant.name}</span></div>
            <div class="detail-row"><span class="label">S\u0110T</span><span class="value"><a href="tel:${tenant.phone}">${tenant.phone || '\u2014'}</a></span></div>
            <div class="detail-row"><span class="label">CCCD/CMND</span><span class="value">${tenant.idNumber || '\u2014'}</span></div>
        </div>
        <div class="detail-section">
            <h3>H\u1ee3p \u0111\u1ed3ng</h3>
            <div class="detail-row"><span class="label">Ph\u00f2ng</span><span class="value">${roomName}</span></div>
            <div class="detail-row"><span class="label">Ng\u00e0y b\u1eaft \u0111\u1ea7u</span><span class="value">${formatDate(tenant.contractStart)}</span></div>
            <div class="detail-row"><span class="label">Ng\u00e0y k\u1ebft th\u00fac</span><span class="value">${formatDate(tenant.contractEnd)}</span></div>
            <div class="detail-row"><span class="label">Tr\u1ea1ng th\u00e1i</span><span class="value"><span class="contract-status ${contract.cls}">${contract.text}</span></span></div>
        </div>
        <div class="detail-actions">
            <button class="btn btn-primary" id="btn-edit-tenant">S\u1eeda</button>
            <button class="btn btn-danger" id="btn-delete-tenant">X\u00f3a</button>
        </div>
    `);

    document.getElementById('btn-edit-tenant').addEventListener('click', () => showTenantForm(tenant.id));
    document.getElementById('btn-delete-tenant').addEventListener('click', () => confirmDeleteTenant(tenant.id));
}

export async function showTenantForm(tenantId, preselectedRoomId) {
    let tenant = { name: '', phone: '', idNumber: '', roomId: preselectedRoomId || '', contractStart: '', contractEnd: '' };
    if (tenantId) {
        tenant = await db.getTenant(tenantId) || tenant;
    }

    const rooms = await db.getAllRooms();
    const roomOptions = rooms.map(r =>
        `<option value="${r.id}" ${tenant.roomId === r.id ? 'selected' : ''}>${r.name}</option>`
    ).join('');

    openModal(tenantId ? 'S\u1eeda ng\u01b0\u1eddi thu\u00ea' : 'Th\u00eam ng\u01b0\u1eddi thu\u00ea', `
        <form id="tenant-form">
            <div class="form-group">
                <label>H\u1ecd t\u00ean *</label>
                <input type="text" id="f-tenant-name" value="${tenant.name}" required placeholder="VD: Nguy\u1ec5n V\u0103n A">
            </div>
            <div class="form-group">
                <label>S\u1ed1 \u0111i\u1ec7n tho\u1ea1i</label>
                <input type="tel" id="f-tenant-phone" value="${tenant.phone || ''}" placeholder="VD: 0901234567">
            </div>
            <div class="form-group">
                <label>CCCD/CMND</label>
                <input type="text" id="f-tenant-id" value="${tenant.idNumber || ''}" placeholder="VD: 079123456789">
            </div>
            <div class="form-group">
                <label>Ph\u00f2ng</label>
                <select id="f-tenant-room">
                    <option value="">-- Ch\u1ecdn ph\u00f2ng --</option>
                    ${roomOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Ng\u00e0y b\u1eaft \u0111\u1ea7u H\u0110</label>
                <input type="date" id="f-tenant-start" value="${tenant.contractStart || ''}">
            </div>
            <div class="form-group">
                <label>Ng\u00e0y k\u1ebft th\u00fac H\u0110</label>
                <input type="date" id="f-tenant-end" value="${tenant.contractEnd || ''}">
            </div>
            <button type="submit" class="btn btn-primary">L\u01b0u</button>
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

        if (data.roomId) {
            const room = await db.getRoom(data.roomId);
            if (room) {
                room.status = 'occupied';
                await db.saveRoom(room);
            }
        }

        speak('\u0110\u00e3 l\u01b0u ng\u01b0\u1eddi thu\u00ea ' + data.name, 'Tenant ' + data.name + ' saved');
        closeModal();
        state.renderPage();
    });
}

async function confirmDeleteTenant(tenantId) {
    const tenant = await db.getTenant(tenantId);
    if (!tenant) return;

    openModal('X\u00e1c nh\u1eadn x\u00f3a', `
        <p style="margin-bottom:16px">B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a ng\u01b0\u1eddi thu\u00ea <strong>${tenant.name}</strong>?</p>
        <button class="btn btn-danger" id="btn-confirm-delete">X\u00f3a</button>
        <button class="btn btn-secondary" id="btn-cancel-delete">H\u1ee7y</button>
    `);

    document.getElementById('btn-confirm-delete').addEventListener('click', () => deleteTenant(tenantId));
    document.getElementById('btn-cancel-delete').addEventListener('click', () => closeModal());
}

async function deleteTenant(tenantId) {
    const tenant = await db.getTenant(tenantId);

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
    speak('\u0110\u00e3 x\u00f3a ng\u01b0\u1eddi thu\u00ea', 'Tenant deleted');
    closeModal();
    state.renderPage();
}
