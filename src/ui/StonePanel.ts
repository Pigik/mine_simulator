import Phaser from 'phaser';
import { drawBevelRect } from './bevel';
import { PANEL_COLORS, PANEL_COLORS_HIGHLIGHT, tintBevelColors, type BevelColors } from './theme';

// Статичная "каменная" панель (фон HUD, карточек, строк таблицы лидеров).
export interface StonePanelOptions {
    accentColor?: number;
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
