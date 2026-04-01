import state from './state.js';

let cachedVoices = [];
if (window.speechSynthesis) {
    cachedVoices = speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', () => {
        cachedVoices = speechSynthesis.getVoices();
    });
}

export function getCachedVoices() {
    if (cachedVoices.length === 0) cachedVoices = speechSynthesis.getVoices();
    return cachedVoices;
}

export function speak(viText, enText) {
    if (!state.voiceEnabled || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    if (cachedVoices.length === 0) {
        cachedVoices = speechSynthesis.getVoices();
    }
    const viVoice = cachedVoices.find(v => v.lang.startsWith('vi'));
    const utter = new SpeechSynthesisUtterance(viVoice ? viText : (enText || viText));
    if (viVoice) {
        utter.voice = viVoice;
        utter.lang = 'vi-VN';
    } else {
        const enVoice = cachedVoices.find(v => v.lang.startsWith('en'));
        if (enVoice) utter.voice = enVoice;
        utter.lang = 'en-US';
    }
    utter.rate = 1;
    utter.volume = 1;
    speechSynthesis.speak(utter);
}
