import Phaser from 'phaser';
import { drawBevelRect } from './bevel';
import { ACCENT, PANEL_COLORS } from './theme';

// Полоса-индикатор (прочность кирки и т.п.) в каменной рамке вместо голого
// текста "50/76". Заливка всегда зелёная — её длина показывает, сколько
// прочности осталось; сама рамка и число поверх неё в стиль не входят и не
// меняются здесь.
export interface StatBarHandle {
    container: Phaser.GameObjects.Container;
    setValue: (current: number, max: number) => void;
}

export function createStatBar(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number
): StatBarHandle {
    const container = scene.add.container(x, y);
    const halfW = width / 2;

    const frame = scene.add.graphics();
    drawBevelRect(frame, width, height, PANEL_COLORS, 3);

    const innerPad = 3;
    const fillWidth = width - innerPad * 2;
    const fill = scene.add.rectangle(-halfW + innerPad, 0, fillWidth, height - innerPad * 2, ACCENT.positive)
        .setOrigin(0, 0.5);

    container.add([fill, frame]);
    container.setSize(width, height);

    const setValue = (current: number, max: number) => {
        const ratio = max > 0 ? Phaser.Math.Clamp(current / max, 0, 1) : 0;
        fill.width = Math.max(0, fillWidth * ratio);
    };

    setValue(1, 1);

    return { container, setValue };
}
