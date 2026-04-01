import db from '../db.js';
import state from '../state.js';
import { $, showToast } from '../helpers.js';
import { speak, getCachedVoices } from '../voice.js';

export async function renderSettingsPage() {
    const mainContent = $('#main-content');
    const electricPrice = await db.getSetting('electricPrice') || '';
    const waterPrice = await db.getSetting('waterPrice') || '';

    mainContent.innerHTML = `
        <div class="backup-section">
            <h3>Gi\u1ecdng n\u00f3i</h3>
            <div class="form-group toggle-group">
                <label>B\u1eadt gi\u1ecdng n\u00f3i</label>
                <label class="toggle">
                    <input type="checkbox" id="f-voice-toggle" ${state.voiceEnabled ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <button type="button" id="btn-test-voice" class="btn btn-secondary" style="margin-top:12px">Test gi\u1ecdng n\u00f3i</button>
            <p id="voice-status" style="font-size:0.85rem;color:var(--text-secondary);margin-top:8px"></p>
        </div>
        <div class="backup-section">
            <h3>Gi\u00e1 \u0111i\u1ec7n / n\u01b0\u1edbc</h3>
            <form id="settings-form">
                <div class="form-group">
                    <label>Gi\u00e1 \u0111i\u1ec7n (\u0111/kWh)</label>
                    <input type="number" id="f-electric-price" value="${electricPrice}" placeholder="VD: 3500">
                </div>
                <div class="form-group">
                    <label>Gi\u00e1 n\u01b0\u1edbc (1000\u0111/ng\u01b0\u1eddi)</label>
                    <input type="number" id="f-water-price" value="${waterPrice}" placeholder="VD: 100">
                </div>
                <button type="submit" class="btn btn-primary">L\u01b0u c\u00e0i \u0111\u1eb7t</button>
            </form>
        </div>
    `;

    const updateVoiceStatus = () => {
        const voices = getCachedVoices();
        const viVoice = voices.find(v => v.lang.startsWith('vi'));
        const status = $('#voice-status');
        if (status) {
            status.textContent = viVoice
                ? 'Gi\u1ecdng Vi\u1ec7t: ' + viVoice.name
                : 'Kh\u00f4ng t\u00ecm th\u1ea5y gi\u1ecdng Vi\u1ec7t. S\u1ebd d\u00f9ng ti\u1ebfng Anh.';
        }
    };
    updateVoiceStatus();

    $('#f-voice-toggle').addEventListener('change', async (e) => {
        state.voiceEnabled = e.target.checked;
        await db.saveSetting('voiceEnabled', state.voiceEnabled);
        if (state.voiceEnabled) {
            speak('\u0110\u00e3 b\u1eadt gi\u1ecdng n\u00f3i', 'Voice enabled');
        }
    });

    $('#btn-test-voice').addEventListener('click', () => {
        updateVoiceStatus();
        const wasEnabled = state.voiceEnabled;
        state.voiceEnabled = true;
        speak('Xin ch\u00e0o, \u0111\u00e2y l\u00e0 gi\u1ecdng n\u00f3i c\u1ee7a \u1ee9ng d\u1ee5ng', 'Hello, this is the app voice');
        state.voiceEnabled = wasEnabled;
    });

    $('#settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await db.saveSetting('electricPrice', $('#f-electric-price').value ? Number($('#f-electric-price').value) : null);
        await db.saveSetting('waterPrice', $('#f-water-price').value ? Number($('#f-water-price').value) : null);
        speak('\u0110\u00e3 l\u01b0u c\u00e0i \u0111\u1eb7t', 'Settings saved');
        showToast('\u0110\u00e3 l\u01b0u c\u00e0i \u0111\u1eb7t!');
    });
}
