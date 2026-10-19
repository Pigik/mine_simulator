// GameplayAPI Яндекс Игр: платформа должна знать, когда идёт игра.
// start() вызывается, только если сцена хочет активный геймплей (wantsActive)
// и платформа не поставила игру на паузу (реклама, свёрнутая вкладка).

function getYsdk(): any | null {
    const w = window as any;
    return (typeof w.ysdk !== 'undefined' && w.ysdk !== null) ? w.ysdk : null;
}

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
    reportedActive = shouldBeActive;

    const api = getGameplayApi();
    if (!api) return;

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
            const w = window as any;
            const readyPromise: Promise<any> | undefined = w.ysdkReady;
            const ysdk = (readyPromise && typeof readyPromise.then === 'function')
                ? await readyPromise
                : getYsdk();

            if (!ysdk || typeof ysdk.on !== 'function') return;

            ysdk.on('game_api_pause', () => {
                platformPaused = true;
                syncState();
            });
            ysdk.on('game_api_resume', () => {
                platformPaused = false;
                syncState();
            });
        } catch (e) { /* SDK недоступен */ }
    })();
}
