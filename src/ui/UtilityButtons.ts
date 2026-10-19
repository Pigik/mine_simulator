import Phaser from 'phaser';
import { createIconToggleButton } from './IconToggleButton';
import { isMuted, toggleMuted } from '../audio/SoundPrefs';
import { isFullscreenActive, toggleFullscreen, onFullscreenChange } from '../yandex/PlatformUtils';

const MUTE_ICON_ON = '🔊';
const MUTE_ICON_OFF = '🔇';
const FULLSCREEN_ICON_ENTER = '⛶';
const FULLSCREEN_ICON_EXIT = '🗗';

// Кнопки звука и полноэкранного режима, общие для всех экранов.
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

    // create() вызывается при каждом scene.start(), без отписки обработчики копились бы.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeFullscreen);
    scene.events.once(Phaser.Scenes.Events.DESTROY, unsubscribeFullscreen);

    return { muteBtn, fsBtn };
}
