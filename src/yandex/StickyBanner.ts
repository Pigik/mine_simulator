// Стики-баннер Яндекс Игр. Показывается один раз на весь сеанс.
// Место баннера настраивается в консоли разработчика (раздел "Реклама"),
// баннер не перекрывает canvas.
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
                console.warn('Sticky banner: реклама не подключена в Консоли разработчика Яндекс Игр.');
            }
        } catch (e) {
            console.warn('Sticky banner: не удалось показать', e);
        }
    })();
}
