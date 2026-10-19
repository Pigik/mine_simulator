import Phaser from 'phaser';
import { createIconToggleButton } from './IconToggleButton';
import { isMuted, toggleMuted } from '../audio/SoundPrefs';
import { isFullscreenActive, toggleFullscreen, onFullscreenChange } from '../yandex/PlatformUtils';

const MUTE_ICON_ON = '🔊';
const MUTE_ICON_OFF = '🔇';
const FULLSCREEN_ICON_ENTER = '⛶';
const FULLSCREEN_ICON_EXIT = '🗗';

// Кнопки звука и полноэкранного режима — общие для всех экранов игры
// (меню, прокачка, лидеры, сам забег), поэтому вынесены в одно место,
// чтобы вести себя и выглядеть одинаково везде.
//
// Кнопка звука — рекомендация (не строгое, но проверяемое требование)
// критериев модерации Яндекс Игр: "добавлена возможность отключения
// звука". Кнопка полноэкранного режима — ручная подстраховка на случай,
// если автозапрос при старте забега (см. requestFullscreenForGameplayIfMobile
// в MenuScene.ts) браузер заблокировал как вызванный не напрямую жестом
// пользователя, а также способ выйти из полноэкранного режима вручную.
export function createUtilityButtons(scene: Phaser.Scene, x: number, y: number, size = 46, gap = 10) {
    const game = scene.game;

    const muteBtn = createIconToggleButton(
        scene, x, y, size,
        isMuted(game) ? MUTE_ICON_OFF : MUTE_ICON_ON,
        () => {
            const muted = toggleMuted(game);
            muteBtn.setIcon(muted ? MUTE_ICON_OFF : MUTE_ICON_ON);
        }
    );
    muteBtn.container.setScrollFactor(0).setDepth(1000);

    const fsBtn = createIconToggleButton(
        scene, x + size + gap, y, size,
        isFullscreenActive() ? FULLSCREEN_ICON_EXIT : FULLSCREEN_ICON_ENTER,
        () => {
            toggleFullscreen();
        }
    );
    fsBtn.container.setScrollFactor(0).setDepth(1000);

    const unsubscribeFullscreen = onFullscreenChange(() => {
        fsBtn.setIcon(isFullscreenActive() ? FULLSCREEN_ICON_EXIT : FULLSCREEN_ICON_ENTER);
    });

    // Сцены Phaser переиспользуются: create() вызывается заново при каждом
    // scene.start() в неё, поэтому без отписки document-обработчик
    // fullscreenchange копился бы с каждым новым посещением сцены.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeFullscreen);
    scene.events.once(Phaser.Scenes.Events.DESTROY, unsubscribeFullscreen);

    return { muteBtn, fsBtn };
}
