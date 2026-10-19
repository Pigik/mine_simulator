import Phaser from 'phaser';

// Глобальное управление звуком.
// Яндекс Игры (п. 1.3): при потере фокуса звук должен останавливаться.
// Пауза при потере фокуса (pauseAll/resumeAll) и mute игрока независимы:
// если игрок выключил звук, он не включится при возврате на вкладку.

const MUTE_STORAGE_KEY = 'miner_muted';

export function loadMutePreference(): boolean {
    try {
        return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch (e) {
        return false;
    }
}

function saveMutePreference(muted: boolean): void {
    try {
        localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    } catch (e) { /* localStorage недоступен */ }
}

export function isMuted(game: Phaser.Game): boolean {
    return game.sound.mute;
}

export function setMuted(game: Phaser.Game, muted: boolean): void {
    game.sound.mute = muted;
    saveMutePreference(muted);
}

export function toggleMuted(game: Phaser.Game): boolean {
    const next = !game.sound.mute;
    setMuted(game, next);
    return next;
}

// Пока открыта полноэкранная реклама, звук на паузе, и снимает её только
// код рекламы (onClose в GameScene), а не обработчик фокуса.
let adOverlayOpen = false;

export function setAdOverlayOpen(open: boolean): void {
    adOverlayOpen = open;
}

// Вызывать один раз после создания Phaser.Game.
export function initGlobalAudioHandling(game: Phaser.Game): void {
    game.sound.mute = loadMutePreference();

    let pausedByBackground = false;

    const pauseForBackground = () => {
        if (pausedByBackground) return;
        pausedByBackground = true;
        game.sound.pauseAll();
    };

    const resumeFromBackground = () => {
        if (!pausedByBackground) return;
        pausedByBackground = false;

        if (adOverlayOpen) return;

        game.sound.resumeAll();
    };

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pauseForBackground();
        else resumeFromBackground();
    });

    // blur/focus — переключение окон (Alt+Tab), когда вкладка остаётся видимой.
    window.addEventListener('blur', pauseForBackground);
    window.addEventListener('focus', resumeFromBackground);

    // pagehide — для мобильных браузеров (iOS Safari), где visibilitychange
    // может не прийти перед уходом в фон.
    window.addEventListener('pagehide', pauseForBackground);
}
