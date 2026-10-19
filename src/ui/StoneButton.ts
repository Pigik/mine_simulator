import Phaser from 'phaser';
import { drawBevelRect } from './bevel';
import { STONE_COLORS, tintBevelColors, type BevelColors } from './theme';
import { playClickSound } from '../audio/clickSound';

// "Каменная" кнопка, рисуется процедурно. При наведении — подсветка и
// стрелки "> ТЕКСТ <", при нажатии — вдавливается.

export interface StoneButtonHandle {
    container: Phaser.GameObjects.Container;
    setLabel: (text: string) => void;
    setEnabled: (enabled: boolean) => void;
    setAccentColor: (color: number | undefined) => void;
}

export interface StoneButtonOptions {
    // Оттенок вместо серого камня, например ACCENT.gold.
    accentColor?: number;
}

type ButtonState = 'idle' | 'hover' | 'down' | 'disabled';

export function createStoneButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick?: () => void,
    fontSize: string = '26px',
    options: StoneButtonOptions = {}
): StoneButtonHandle {
    const container = scene.add.container(x, y);
    const bg = scene.add.graphics();

    const halfW = width / 2;
    const halfH = height / 2;
    const bevel = 4;

    let currentAccent = options.accentColor;

    const colorsFor = (state: ButtonState): BevelColors => {
        const base = STONE_COLORS[state];
        return currentAccent !== undefined ? tintBevelColors(base, currentAccent, 0.4) : base;
    };

    const drawState = (state: ButtonState) => {
        bg.clear();
        drawBevelRect(bg, width, height, colorsFor(state), bevel);

        if (state === 'hover') {
            bg.fillStyle(0xffffff, 0.10);
            bg.fillRect(-halfW + bevel, -halfH + bevel, width - bevel * 2, height - bevel * 2);
        }
    };

    drawState('idle');

    const text = scene.add.text(0, 0, label, {
        fontFamily: 'Courier', fontSize, color: '#ffffff', fontStyle: 'bold',
        stroke: '#2b2b2b', strokeThickness: 4
    }).setOrigin(0.5);

    const arrowGap = Math.min(28, width * 0.12);
    const arrowLeft = scene.add.text(-halfW + arrowGap, 0, '>', {
        fontFamily: 'Courier', fontSize, color: '#ffffa0', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);
    const arrowRight = scene.add.text(halfW - arrowGap, 0, '<', {
        fontFamily: 'Courier', fontSize, color: '#ffffa0', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);

    container.add([bg, text, arrowLeft, arrowRight]);
    container.setSize(width, height);

    let enabled = true;
    let hovering = false;

    const applyIdleOrHover = () => {
        if (!enabled) return;
        drawState(hovering ? 'hover' : 'idle');
        text.setColor(hovering ? '#ffffa0' : '#ffffff');
        arrowLeft.setAlpha(hovering ? 1 : 0);
        arrowRight.setAlpha(hovering ? 1 : 0);
    };

    container.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, width, height),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
    });

    container.on('pointerover', () => { hovering = true; applyIdleOrHover(); });
    container.on('pointerout', () => { hovering = false; container.setScale(1); applyIdleOrHover(); });
    container.on('pointerdown', () => {
        if (!enabled) return;
        drawState('down');
        container.setScale(0.97);
    });
    container.on('pointerup', () => {
        if (!enabled) return;
        container.setScale(1);
        applyIdleOrHover();
        playClickSound(scene);
        if (onClick) onClick();
    });

    return {
        container,
        setLabel: (t: string) => text.setText(t),
        setAccentColor: (color: number | undefined) => {
            currentAccent = color;
            if (enabled) {
                applyIdleOrHover();
            } else {
                drawState('disabled');
            }
        },
        setEnabled: (v: boolean) => {
            enabled = v;
            if (!v) {
                drawState('disabled');
                text.setColor('#9a9a9a');
                arrowLeft.setAlpha(0);
                arrowRight.setAlpha(0);
                container.disableInteractive();
            } else {
                container.setInteractive({
                    hitArea: new Phaser.Geom.Rectangle(0, 0, width, height),
                    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                    useHandCursor: true
                });
                applyIdleOrHover();
            }
        }
    };
}
