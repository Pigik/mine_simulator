import Phaser from 'phaser';
import { drawBevelRect } from './bevel';
import { PANEL_COLORS, PANEL_COLORS_HIGHLIGHT, tintBevelColors, type BevelColors } from './theme';

// Статичная "каменная" панель — тот же bevel-стиль, что у кнопок, но без
// интерактивности. Используется как замена голым полупрозрачным
// rectangle: фон под текстом баланса в меню, карточки апгрейдов, строки и
// подиум таблицы лидеров, HUD во время игры.
export interface StonePanelOptions {
    // Акцентный оттенок (например золото) вместо серого камня — для
    // выделенных элементов (например строка текущего игрока в таблице).
    accentColor?: number;
    // Готовый набор цветов вместо accentColor/highlight — для тонкой
    // настройки конкретной плашки.
    colors?: BevelColors;
    highlight?: boolean;
    bevel?: number;
}

export function createStonePanel(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    opts: StonePanelOptions = {}
): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();

    let colors = opts.colors ?? (opts.highlight ? PANEL_COLORS_HIGHLIGHT : PANEL_COLORS);
    if (opts.accentColor !== undefined) {
        colors = tintBevelColors(PANEL_COLORS, opts.accentColor, 0.35);
    }

    drawBevelRect(g, width, height, colors, opts.bevel ?? 4);
    container.add(g);
    container.setSize(width, height);
    return container;
}
