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

// Яндекс Игры (п. 1.6.1): лонгтап не должен открывать контекстное меню.
// CSS в style.css покрывает не все мобильные браузеры.
window.addEventListener('contextmenu', (e) => e.preventDefault());

async function bootGame(): Promise<void> {
    // Язык и облачный прогресс нужны до создания первой сцены,
    // иначе меню мигнёт не тем языком / пустым прогрессом.
    await Promise.all([detectAndSetLocale(), initCloudSave()]);

    try {
        document.title = t('menu.title');
    } catch (e) { /* не критично */ }

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
                gravity: { y: 520, x: 0 },
                debug: false
            }
        },
        scene: [MainMenuScene, UpgradeScene, GameScene, LeaderboardScene]
    };

    const game = new Phaser.Game(config);

    initGlobalAudioHandling(game);
    initGameplayApiTracking();
    initStickyBanner();
}

bootGame();
