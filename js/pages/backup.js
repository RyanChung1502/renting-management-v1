import db from '../db.js';
import state from '../state.js';
import { $, showToast } from '../helpers.js';
import { speak } from '../voice.js';

export function renderBackupPage() {
    const mainContent = $('#main-content');
    mainContent.innerHTML = `
        <div class="backup-section">
            <h3>Sao l\u01b0u d\u1eef li\u1ec7u</h3>
            <p>T\u1ea3i xu\u1ed1ng to\u00e0n b\u1ed9 d\u1eef li\u1ec7u d\u01b0\u1edbi d\u1ea1ng file JSON. L\u01b0u file n\u00e0y \u0111\u1ec3 kh\u00f4i ph\u1ee5c khi c\u1ea7n.</p>
            <button class="btn btn-primary" id="btn-export-data">T\u1ea3i xu\u1ed1ng b\u1ea3n sao l\u01b0u</button>
        </div>
        <div class="backup-section">
            <h3>Kh\u00f4i ph\u1ee5c d\u1eef li\u1ec7u</h3>
            <p>T\u1ea3i l\u00ean file JSON sao l\u01b0u tr\u01b0\u1edbc \u0111\u00f3. <strong style="color:var(--danger)">D\u1eef li\u1ec7u hi\u1ec7n t\u1ea1i s\u1ebd b\u1ecb ghi \u0111\u00e8.</strong></p>
            <input type="file" id="import-file" accept=".json" style="display:none">
            <button class="btn btn-secondary" id="btn-import-data">Ch\u1ecdn file \u0111\u1ec3 kh\u00f4i ph\u1ee5c</button>
        </div>
    `;

    document.getElementById('btn-export-data').addEventListener('click', exportData);
    document.getElementById('btn-import-data').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', importData);
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
    speak('\u0110\u00e3 t\u1ea3i xu\u1ed1ng b\u1ea3n sao l\u01b0u', 'Backup downloaded');
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
        const backup = JSON.parse(text);
        if (!backup.data || !backup.data.rooms) {
            showToast('File kh\u00f4ng h\u1ee3p l\u1ec7!');
            return;
        }
        await db.importAll(backup);
        speak('Kh\u00f4i ph\u1ee5c th\u00e0nh c\u00f4ng', 'Restore completed');
        showToast('Kh\u00f4i ph\u1ee5c th\u00e0nh c\u00f4ng!');
        state.renderPage();
    } catch (e) {
        showToast('L\u1ed7i \u0111\u1ecdc file: ' + e.message);
    }
}
