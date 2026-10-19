// Полноэкранный режим и тип устройства.
// Яндекс Игры (п. 1.6.1): на мобильных игра должна быть в полноэкранном режиме.
// Сначала используется SDK, вне Яндекс Игр — браузерный Fullscreen API.
//
// Браузеры разрешают полноэкранный режим только прямо в обработчике клика/тапа,
// не через промисы и таймеры.

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

// Без SDK тип устройства определяется по User-Agent.
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

// Вызывать только из обработчика клика/тапа.
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
    } catch (e) { /* не критично */ }
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

// Только на мобильных. Вызывать из обработчика нажатия "Играть".
export function requestFullscreenForGameplayIfMobile(): void {
    if (isMobileDevice() && !isFullscreenActive()) {
        requestFullscreen();
    }
}
