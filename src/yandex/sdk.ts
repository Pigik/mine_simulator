// Общий доступ к SDK Яндекс Игр. Сама инициализация — в index.html
// (window.ysdk и промис window.ysdkReady).

// SDK, если уже инициализирован, иначе null.
export function getYsdk(): any | null {
    const w = window as any;
    return w.ysdk ?? null;
}

// Ждёт инициализации SDK. Возвращает null вне Яндекс Игр, при ошибке
// или если SDK не ответил за timeoutMs (null — ждать без ограничения).
export async function waitForYsdk(timeoutMs: number | null = 3000): Promise<any | null> {
    const ready: Promise<any> | undefined = (window as any).ysdkReady;
    if (!ready || typeof ready.then !== 'function') return getYsdk();

    try {
        if (timeoutMs === null) return await ready;
        return await Promise.race([
            ready,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
        ]);
    } catch (e) {
        return null;
    }
}

let gameReadyReported = false;

// LoadingAPI.ready(): сообщает платформе, что игра загрузилась и в неё
// можно играть. Вызывать, когда показан первый интерактивный экран.
export function notifyGameReady(): void {
    if (gameReadyReported) return;
    gameReadyReported = true;

    // Без таймаута: если SDK инициализируется дольше обычного,
    // сообщить о готовности всё равно нужно.
    waitForYsdk(null).then((ysdk) => {
        try {
            ysdk?.features?.LoadingAPI?.ready();
        } catch (e) { /* не критично */ }
    });
}
