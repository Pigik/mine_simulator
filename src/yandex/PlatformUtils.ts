// Утилиты для полноэкранного режима и определения типа устройства.
//
// Требования Яндекс Игр (см. https://yandex.ru/dev/games/doc/ru/concepts/requirements,
// п. 1.6.1): "Игра находится в полноэкранном режиме во время игрового
// процесса или запуска" — обязательно для мобильных устройств.
//
// Предпочитаем SDK Яндекс Игр (ysdk.screen.fullscreen.*, ysdk.deviceInfo()) —
// он корректно работает и внутри мобильных обёрток/веб-вью платформы, где
// обычный браузерный Fullscreen API может вести себя иначе. Если игра
// запущена не на Яндекс Играх (например, локальная разработка) или нужный
// метод SDK недоступен — тихо откатываемся на стандартный Fullscreen API
// браузера и на проверку navigator.userAgent.
//
// ВАЖНО: большинство браузеров разрешают включать полноэкранный режим
// только сразу внутри обработчика пользовательского жеста (клик/тап) — не
// откладывайте вызов requestFullscreen()/requestFullscreenForGameplayIfMobile()
// через промисы/таймеры, иначе браузер молча откажет.

function getYsdk(): any | null {
    const w = window as any;
    return (typeof w.ysdk !== 'undefined' && w.ysdk !== null) ? w.ysdk : null;
}

function getYsdkFullscreen(): any | null {
    try {
        const ysdk = getYsdk();
        return (ysdk && ysdk.screen && ysdk.screen.fullscreen) ? ysdk.screen.fullscreen : null;
    } catch (e) {
        return null;
    }
}

// deviceInfo()/isMobile() — часть SDK Яндекс Игр (см. sdk-params). Если
// недоступны (локальная разработка вне платформы), определяем тип
// устройства по User-Agent — этого достаточно, чтобы решить, нужен ли
// автозапрос полноэкранного режима.
export function isMobileDevice(): boolean {
    try {
        const ysdk = getYsdk();
        if (ysdk && typeof ysdk.deviceInfo === 'function') {
            const info = ysdk.deviceInfo();
            if (info) {
                const mobile = typeof info.isMobile === 'function' && info.isMobile();
                const tablet = typeof info.isTablet === 'function' && info.isTablet();
                if (mobile || tablet) return true;
                if (typeof info.type === 'string') return info.type === 'mobile' || info.type === 'tablet';
            }
        }
    } catch (e) { /* падаем на UA-детект ниже */ }

    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isFullscreenActive(): boolean {
    try {
        const fs = getYsdkFullscreen();
        if (fs) return fs.status === 'on' || fs.status === fs.STATUS_ON;
    } catch (e) { /* падаем на нативный API ниже */ }

    const d = document as any;
    return !!(d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement);
}

// Запрашивает полноэкранный режим. Вызывать ТОЛЬКО из обработчика прямого
// пользовательского действия (клик/тап) — см. предупреждение выше.
export function requestFullscreen(): void {
    try {
        const fs = getYsdkFullscreen();
        if (fs && typeof fs.request === 'function') {
            fs.request();
            return;
        }
    } catch (e) { /* падаем на нативный API ниже */ }

    try {
        const el = document.documentElement as any;
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } catch (e) { /* полноэкранный режим недоступен — не критично для игры */ }
}

export function exitFullscreen(): void {
    try {
        const fs = getYsdkFullscreen();
        if (fs && typeof fs.exit === 'function') {
            fs.exit();
            return;
        }
    } catch (e) { /* падаем на нативный API ниже */ }

    try {
        const d = document as any;
        if (d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement) {
            if (d.exitFullscreen) d.exitFullscreen().catch(() => {});
            else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
            else if (d.msExitFullscreen) d.msExitFullscreen();
        }
    } catch (e) { /* не критично */ }
}

export function toggleFullscreen(): void {
    if (isFullscreenActive()) exitFullscreen();
    else requestFullscreen();
}

// Подписка на изменение состояния полноэкранного режима (например, игрок
// сам нажал Esc) — чтобы иконка кнопки могла оставаться актуальной.
// Возвращает функцию отписки.
export function onFullscreenChange(cb: () => void): () => void {
    const handler = () => cb();
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    document.addEventListener('MSFullscreenChange', handler);
    return () => {
        document.removeEventListener('fullscreenchange', handler);
        document.removeEventListener('webkitfullscreenchange', handler);
        document.removeEventListener('MSFullscreenChange', handler);
    };
}

// Запрашивает полноэкранный режим для геймплея на мобильных устройствах —
// вызывать напрямую из обработчика клика/тапа по кнопке "Играть" (см.
// requirements п. 1.6.1 в шапке файла). На десктопе ничего не делает: там
// полноэкранный режим не обязателен и был бы неожиданным для игрока.
export function requestFullscreenForGameplayIfMobile(): void {
    if (isMobileDevice() && !isFullscreenActive()) {
        requestFullscreen();
    }
}
