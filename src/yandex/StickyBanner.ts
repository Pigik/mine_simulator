// Обёртка над стики-баннером Яндекс Игр (ysdk.adv.showBannerAdv) —
// отдельный от interstitial/rewarded формат: небольшая, ПОСТОЯННО видимая
// рекламная полоска сбоку/сверху/снизу экрана (см.
// https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv).
//
// ВАЖНО про расположение: ГДЕ именно на странице появится баннер (низ/верх
// на мобильных, справа на десктопе) настраивается в Консоли разработчика
// Яндекс Игр (раздел "Реклама"), а не здесь в коде. Платформа сама
// размещает баннер в свободном месте СТРАНИЦЫ вокруг игрового canvas
// (например в леттербоксе по бокам при Phaser.Scale.FIT на широких
// экранах) — он не рисуется поверх содержимого самой игры и не требует
// никаких изменений в вёрстке/размерах canvas под него.
//
// По договорённости с разработчиком игры показывается ОДИН раз на весь
// сеанс — и в меню, и во время самой добычи — поэтому отдельного
// hideBannerAdv() между сценами здесь нет.
export function initStickyBanner(): void {
    (async () => {
        try {
            const w = window as any;
            const readyPromise: Promise<any> | undefined = w.ysdkReady;
            const ysdk = (readyPromise && typeof readyPromise.then === 'function')
                ? await readyPromise
                : (typeof w.ysdk !== 'undefined' ? w.ysdk : null);

            if (!ysdk || !ysdk.adv || typeof ysdk.adv.showBannerAdv !== 'function') return;

            const result = await ysdk.adv.showBannerAdv();
            if (result && result.reason === 'ADV_IS_NOT_CONNECTED') {
                // Не ошибка кода — стики-баннер ещё не подключён/не
                // настроен в Консоли разработчика Яндекс Игр (вкладка
                // "Реклама"). См. комментарий выше.
                console.warn('Sticky banner: реклама не подключена в Консоли разработчика Яндекс Игр.');
            }
        } catch (e) {
            // Локальная разработка вне платформы или SDK недоступен —
            // не критично для игры.
            console.warn('Sticky banner: не удалось показать', e);
        }
    })();
}
