import Phaser from 'phaser';

// Глобальное управление звуком, не привязанное к конкретной сцене.
//
// Закрывает два пункта из требований/критериев модерации Яндекс Игр
// (см. https://yandex.ru/dev/games/doc/ru/concepts/requirements):
// 1) п. 1.3 (обязательно): "При потере фокуса звук останавливается" —
//    при сворачивании вкладки/переключении на другое окно или приложение
//    весь звук должен замолкать, а при возврате фокуса — снова звучать
//    (если игрок сам не отключил звук вручную).
// 2) Рекомендация (не строгое требование, но проверяется): в игре должна
//    быть возможность вручную отключить звук — см. createUtilityButtons
//    в src/ui/UtilityButtons.ts.
//
// pauseAll()/resumeAll() (временная пауза на время потери фокуса) и mute
// (постоянный выбор игрока) — независимые механизмы: resumeAll() при
// возврате фокуса просто снимает паузу со звуков, а слышимость по-прежнему
// определяется текущим mute. Поэтому если игрок заранее включил mute,
// звук останется беззвучным и после возврата на вкладку — никакого
// "внезапного" звука не будет.

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
    } catch (e) { /* приватный режим / localStorage недоступен — не критично */ }
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

// Открыта ли сейчас полноэкранная реклама (interstitial/rewarded video).
// Пока она открыта, звук уже поставлен на паузу самим кодом показа рекламы
// (см. onOpen/onClose в GameScene.ts) — и снимать эту паузу должен только
// он сам, а не наш обработчик потери фокуса ниже (см. пояснение в
// initGlobalAudioHandling).
let adOverlayOpen = false;

export function setAdOverlayOpen(open: boolean): void {
    adOverlayOpen = open;
}

// Вызывать РОВНО ОДИН РАЗ, сразу после создания Phaser.Game (см. main.ts).
// Устанавливает сохранённое предпочтение по звуку и вешает глобальные
// обработчики потери фокуса вкладки/окна на весь сеанс игры — не завязано
// на конкретную сцену, поэтому одинаково работает в меню, прокачке,
// таблице лидеров и во время самого забега.
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

        // Если пользователь успел свернуть вкладку/переключить окно, пока
        // на экране была открыта полноэкранная реклама, не возобновляем
        // звук за неё — она сама вызовет resumeAll() в своём onClose,
        // когда закроется. Иначе игрок услышал бы игровой звук поверх ещё
        // не закрытой рекламы.
        if (adOverlayOpen) return;

        game.sound.resumeAll();
    };

    // Основной случай: переключение вкладки, сворачивание окна, блокировка
    // экрана на мобильном — всё это меняет document.hidden.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pauseForBackground();
        else resumeFromBackground();
    });

    // blur/focus дополнительно закрывают случай переключения между окнами
    // на десктопе, когда сама вкладка остаётся видимой (document.hidden не
    // меняется), но фокус уходит с окна браузера целиком (например, Alt+Tab).
    window.addEventListener('blur', pauseForBackground);
    window.addEventListener('focus', resumeFromBackground);

    // pagehide — подстраховка для части мобильных браузеров (например,
    // сворачивание в iOS Safari), где visibilitychange иногда приходит с
    // задержкой или не приходит вовсе перед уходом в фон.
    window.addEventListener('pagehide', pauseForBackground);
}
