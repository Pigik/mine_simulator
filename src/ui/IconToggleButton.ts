import Phaser from 'phaser';
import { drawBevelRect } from './bevel';
import { STONE_COLORS } from './theme';
import { playClickSound } from '../audio/clickSound';

// Маленькая квадратная кнопка-иконка (звук, полноэкранный режим).

export interface IconToggleButtonHandle {
    container: Phaser.GameObjects.Container;
    setIcon: (icon: string) => void;
    destroy: () => void;
}

type ButtonState = 'idle' | 'hover' | 'down';

export function createIconToggleButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
    icon: string,
    onClick: () => void
): IconToggleButtonHandle {
    const container = scene.add.container(x, y);
    const bg = scene.add.graphics();

    const drawState = (state: ButtonState) => {
        bg.clear();
        drawBevelRect(bg, size, size, STONE_COLORS[state], 3);
        if (state === 'hover') {
            bg.fillStyle(0xffffff, 0.10);
            bg.fillRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6);
        }
    };
    drawState('idle');

    const text = scene.add.text(0, 0, icon, {
        fontFamily: 'Courier', fontSize: `${Math.floor(size * 0.5)}px`, color: '#ffffff'
    }).setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(size, size);
    container.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, size, size),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
    });

    let hovering = false;
    container.on('pointerover', () => { hovering = true; drawState('hover'); });
    container.on('pointerout', () => { hovering = false; container.setScale(1); drawState('idle'); });
    container.on('pointerdown', () => { drawState('down'); container.setScale(0.94); });
    container.on('pointerup', () => {
        container.setScale(1);
        drawState(hovering ? 'hover' : 'idle');
        playClickSound(scene);
        onClick();
    });

    return {
        container,
        setIcon: (newIcon: string) => text.setText(newIcon),
        destroy: () => container.destroy()
    };
}
