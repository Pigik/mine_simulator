import Phaser from 'phaser';
import './style.css';
import { MainMenuScene, UpgradeScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { initGlobalAudioHandling } from './audio/SoundPrefs';
import { detectAndSetLocale, t } from './i18n';
import { initGameplayApiTracking } from './yandex/GameplayApi';
import { initCloudSave } from './yandex/CloudSave';
import { initStickyBanner } from './yandex/StickyBanner';

// Запуск обёрнут в async-функцию: язык (см. detectAndSetLocale) и
// облачный прогресс (см. initCloudSave) нужно определить ДО создания
// Phaser.Game и первой сцены — иначе главное меню могло бы на долю секунды
// отрисоваться не на том языке или с пустым/неполным прогрессом, а затем
// "мигнуть" правильными данными. Требование Яндекс Игр — встроенное
// автоопределение языка через SDK (без непереведённых надписей) и перенос
// прогресса между устройствами/браузерами через серверные данные SDK (а не
// только localStorage).
// Требование Яндекс Игр (п. 1.6.1): "Лонгтап не приводит к выделению поля
// или контекстному меню". CSS (touch-action/user-select, см. style.css)
// закрывает большинство браузеров, но системное контекстное меню на
// длинный тап по <canvas> в некоторых мобильных браузерах всё равно нужно
// подавлять явно через contextmenu.
window.addEventListener('contextmenu', (e) => e.preventDefault());

async function bootGame(): Promise<void> {
    await Promise.all([detectAndSetLocale(), initCloudSave()]);

    // Название игры в заголовке вкладки должно дословно совпадать с тем,
    // что показывается в самой игре (см. menu.title в src/i18n/*.ts) — это
    // тот же текст на том же определённом языке, а не захардкоженная
    // строка в index.html. Сам <title> в index.html задаёт только
    // значение ДО выполнения этого кода (первый кадр до загрузки SDK/JS).
    try {
        document.title = t('menu.title');
    } catch (e) { /* не критично для игры */ }

    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 1600,
        height: 900,
        parent: 'app',
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        physics: {
            default: 'arcade',
            arcade: {
                // Чуть мягче, чем было (600) — падение выглядит спокойнее и
                // даёт глазу время следить за киркой между ударами; сочетается с
                // более сдержанной упругостью (см. pickaxe.setBounce в GameScene).
                gravity: { y: 520, x: 0 },
                debug: false
            }
        },
        // Регистрация новых сцен $\mathcal{O}(1)$
        scene: [MainMenuScene, UpgradeScene, GameScene, LeaderboardScene]
    };

    const game = new Phaser.Game(config);

    // Требование Яндекс Игр (см. src/audio/SoundPrefs.ts): звук должен
    // останавливаться при потере фокуса вкладки/окна и поддерживать ручное
    // отключение игроком. Настраивается один раз на весь сеанс игры, не
    // привязано к конкретной сцене.
    initGlobalAudioHandling(game);

    // Требование Яндекс Игр (см. src/yandex/GameplayApi.ts): платформа
    // должна знать через GameplayAPI.start()/stop(), когда игрок реально
    // играет, а когда сидит в меню/на паузе.
    initGameplayApiTracking();

    // Монетизация: стики-баннер (см. src/yandex/StickyBanner.ts) — по
    // договорённости с разработчиком показывается на весь сеанс сразу и в
    // меню, и во время добычи, поэтому включается один раз здесь же, а не
    // отдельно в каждой сцене.
    initStickyBanner();
}

bootGame();
