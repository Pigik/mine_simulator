import Phaser from 'phaser';
import type { BevelColors } from './theme';

// "Каменная" плашка со скошенными краями. Центр прямоугольника — в (0,0).
export function drawBevelRect(
    g: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    colors: BevelColors,
    bevel = 4
) {
    const halfW = width / 2;
    const halfH = height / 2;

    // Внешняя тёмная рамка
    g.fillStyle(colors.border, 1);
    g.fillRect(-halfW, -halfH, width, height);

    // Основная заливка
    g.fillStyle(colors.base, 1);
    g.fillRect(-halfW + bevel, -halfH + bevel, width - bevel * 2, height - bevel * 2);

    // Светлая грань сверху и слева
    g.fillStyle(colors.hi, 1);
    g.fillRect(-halfW + bevel, -halfH + bevel, width - bevel * 2, bevel);
    g.fillRect(-halfW + bevel, -halfH + bevel, bevel, height - bevel * 2);

    // Тёмная грань снизу и справа
    g.fillStyle(colors.sh, 1);
    g.fillRect(-halfW + bevel, halfH - bevel * 2, width - bevel * 2, bevel);
    g.fillRect(halfW - bevel * 2, -halfH + bevel, bevel, height - bevel * 2);
}
