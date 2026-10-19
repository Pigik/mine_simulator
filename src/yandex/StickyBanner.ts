// Стики-баннер Яндекс Игр. Показывается один раз на весь сеанс.
// Место баннера настраивается в консоли разработчика (раздел "Реклама"),
// баннер не перекрывает canvas.
import { waitForYsdk } from './sdk';

export function initStickyBanner(): void {
    (async () => {
        try {
            const ysdk = await waitForYsdk(null);

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
