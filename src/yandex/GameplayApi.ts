// Обёртка над GameplayAPI Яндекс Игр — обязательное требование: платформа
// должна знать, когда игрок реально играет, а когда сидит в меню/на паузе
// (см. https://yandex.com/dev/games/doc/en/sdk/sdk-game-events).
//
// GameplayAPI.start()/stop() не вызываются напрямую из сцен — вместо этого
// сцены выставляют только СВОЁ намерение через setGameplayWantsActive(), а
// здесь оно объединяется с состоянием, о котором сообщает сама платформа:
//
// - wantsActive — сама игра считает, что сейчас идёт активный забег (не
//   меню, не экран поражения) — см. вызовы в GameScene.ts/MenuScene.ts/
//   LeaderboardScene.ts.
// - platformPaused — платформа сама сообщила через событие game_api_pause,
//   что показывает поверх игры рекламу/окно оплаты, либо игрок свернул
//   вкладку/окно — выставляется автоматически подпиской ниже, из игрового
//   кода трогать не нужно.
//
// GameplayAPI.start() вызывается, только когда ОБА условия истинны; stop()
// — как только любое из них перестаёт выполняться. Так учтён нюанс из
// документации: если геймплей уже остановлен нами (игрок в меню) и в этот
// момент приходит game_api_pause/resume от рекламы или сворачивания окна,
// повторный старт не произойдёт, пока меню не закрыто по-настоящему.

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
// Текущее состояние, о котором мы уже сообщили в SDK — чтобы не дёргать
// start()/stop() повторно, если ничего по сути не изменилось.
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
    } catch (e) { /* не критично для геймплея */ }
}

// Вызывать из сцен: true — начался/продолжился активный забег (см.
// GameScene.create() и восстановление после rewarded-рекламы), false —
// игрок в главном меню/прокачке/таблице лидеров либо смотрит экран
// поражения (см. checkGameOver()/claimBalanceAndExit() в GameScene.ts).
export function setGameplayWantsActive(active: boolean): void {
    wantsActive = active;
    syncState();
}

// Вызывать РОВНО ОДИН РАЗ при старте игры (см. main.ts) — подписывается на
// game_api_pause/game_api_resume, как только (и если) станет доступен SDK
// Яндекс Игр.
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
        } catch (e) { /* SDK недоступен (локальная разработка) — не критично */ }
    })();
}
