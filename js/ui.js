import { $, showToast } from './helpers.js';

const sideMenu = $('#side-menu');
const menuOverlay = $('#menu-overlay');
const modalOverlay = $('#modal-overlay');
const modalTitle = $('#modal-title');
const modalBody = $('#modal-body');

export function openMenu() {
    menuOverlay.classList.remove('hidden');
    sideMenu.classList.remove('hidden');
    requestAnimationFrame(() => sideMenu.classList.add('open'));
}

export function closeMenu() {
    sideMenu.classList.remove('open');
    setTimeout(() => {
        sideMenu.classList.add('hidden');
        menuOverlay.classList.add('hidden');
    }, 300);
}

export function openModal(title, bodyHTML) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHTML;
    modalOverlay.classList.remove('hidden');
}

export function closeModal() {
    modalOverlay.classList.add('hidden');
}

export function shareOrCopy(text, toastMsg) {
    if (navigator.share) {
        navigator.share({ text }).catch(e => {
            if (e.name !== 'AbortError') copyToClipboard(text, toastMsg);
        });
    } else {
        copyToClipboard(text, toastMsg);
    }
}

function copyToClipboard(text, toastMsg) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(toastMsg || '\u0110\u00e3 sao ch\u00e9p');
    }).catch(() => {
        showToast('Kh\u00f4ng th\u1ec3 sao ch\u00e9p');
    });
}
