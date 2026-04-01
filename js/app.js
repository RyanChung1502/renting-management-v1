import db from './db.js';
import state from './state.js';
import { $, showToast } from './helpers.js';
import { speak } from './voice.js';
import { openMenu, closeMenu, closeModal } from './ui.js';
import { renderRoomList, showRoomForm } from './pages/rooms.js';
import { renderTenantList, showTenantForm } from './pages/tenants.js';
import { renderElectricPage } from './pages/electric.js';
import { renderSettingsPage } from './pages/settings.js';
import { renderBackupPage } from './pages/backup.js';

// DOM References
const mainContent = $('#main-content');
const fab = $('#fab');
const searchBar = $('#search-bar');
const searchInput = $('#search-input');
const menuOverlay = $('#menu-overlay');
const modalOverlay = $('#modal-overlay');
const pageTitle = $('#page-title');

// Page Router
function renderPage() {
    switch (state.currentPage) {
        case 'rooms':
            pageTitle.textContent = 'Danh s\u00e1ch ph\u00f2ng';
            fab.classList.remove('hidden');
            renderRoomList();
            break;
        case 'tenants':
            pageTitle.textContent = 'Ng\u01b0\u1eddi thu\u00ea';
            fab.classList.remove('hidden');
            renderTenantList();
            break;
        case 'electric':
            pageTitle.textContent = '\u0110i\u1ec7n & N\u01b0\u1edbc';
            fab.classList.add('hidden');
            renderElectricPage();
            break;
        case 'settings':
            pageTitle.textContent = 'C\u00e0i \u0111\u1eb7t';
            fab.classList.add('hidden');
            renderSettingsPage();
            break;
        case 'backup':
            pageTitle.textContent = 'Sao l\u01b0u / Kh\u00f4i ph\u1ee5c';
            fab.classList.add('hidden');
            renderBackupPage();
            break;
    }
}

// Store renderPage in state so other modules can call it
state.renderPage = renderPage;

// Event Listeners
function setupEventListeners() {
    // Search
    $('#btn-search').addEventListener('click', () => {
        searchBar.classList.toggle('hidden');
        if (!searchBar.classList.contains('hidden')) {
            searchInput.focus();
        } else {
            searchInput.value = '';
            state.searchQuery = '';
            renderPage();
        }
    });
    $('#btn-search-close').addEventListener('click', () => {
        searchBar.classList.add('hidden');
        searchInput.value = '';
        state.searchQuery = '';
        renderPage();
    });
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
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
            state.currentPage = e.target.dataset.page;
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
        speak('\u0110\u00e3 sao l\u01b0u', 'Backup done');
        showToast('\u0110\u00e3 sao l\u01b0u!');
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
        if (state.currentPage === 'rooms') {
            speak('Th\u00eam ph\u00f2ng m\u1edbi', 'Add new room');
            showRoomForm();
        } else if (state.currentPage === 'tenants') {
            speak('Th\u00eam ng\u01b0\u1eddi thu\u00ea m\u1edbi', 'Add a new tenant');
            showTenantForm();
        }
    });

    // Modal
    $('#modal-close').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    state.voiceEnabled = (await db.getSetting('voiceEnabled')) || false;
    speechSynthesis.getVoices();
    setupEventListeners();
    renderPage();
});
