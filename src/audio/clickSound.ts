import Phaser from 'phaser';

// Звук нажатия на кнопки интерфейса.
export function playClickSound(scene: Phaser.Scene): void {
    try {
        if (scene.cache.audio.exists('click-menu')) {
            scene.sound.play('click-menu', { volume: 0.5 });
        }
    } catch (e) { /* не критично */ }
}
