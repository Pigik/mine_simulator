// GameplayAPI Яндекс Игр: платформа должна знать, когда идёт игра.
// start() вызывается, только если сцена хочет активный геймплей (wantsActive)
// и платформа не поставила игру на паузу (реклама, свёрнутая вкладка).
import { getYsdk, waitForYsdk } from './sdk';

function getGameplayApi(): any | null {
    try {
        const ysdk = getYsdk();
        return (ysdk && ysdk.features && ysdk.features.GameplayAPI) ? ysdk.features.GameplayAPI : null;
    } catch (e) {
        return null;
    }
}

let wantsActive = false;
let platformPaused = false;
// Последнее состояние, отправленное в SDK.
let reportedActive = false;

function syncState(): void {
    const shouldBeActive = wantsActive && !platformPaused;
    if (shouldBeActive === reportedActive) return;

    // Пока SDK не готов, состояние не фиксируем — отправим после инициализации.
    const api = getGameplayApi();
    if (!api) return;
    reportedActive = shouldBeActive;

    try {
        if (shouldBeActive) api.start();
        else api.stop();
    } catch (e) { /* не критично */ }
}

// true — идёт забег, false — меню, прокачка, лидеры или экран поражения.
export function setGameplayWantsActive(active: boolean): void {
    wantsActive = active;
    syncState();
}

// Вызывать один раз при старте. Подписывается на game_api_pause/resume.
export function initGameplayApiTracking(): void {
    (async () => {
        try {
            const ysdk = await waitForYsdk(null);
            if (!ysdk || typeof ysdk.on !== 'function') return;

            ysdk.on('game_api_pause', () => {
                platformPaused = true;
                syncState();
            });
            ysdk.on('game_api_resume', () => {
                platformPaused = false;
                syncState();
            });

            syncState();
        } catch (e) { /* SDK недоступен */ }
    })();
}
