import Phaser from 'phaser';

// Процедурная иконка монеты: текстура генерируется один раз и переиспользуется.
const COIN_TEXTURE_KEY = 'ui_coin_icon';
const COIN_SIZE = 22;

function ensureCoinTexture(scene: Phaser.Scene) {
    if (scene.textures.exists(COIN_TEXTURE_KEY)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });
    const c = COIN_SIZE / 2;

    // Контур
    g.fillStyle(0x4a3200, 1);
    g.fillCircle(c, c, c);

    // Заливка
    g.fillStyle(0xffd700, 1);
    g.fillCircle(c, c, c - 2);

    // Тень
    g.fillStyle(0xd4af00, 1);
    g.slice(c, c, c - 2, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(165), false);
    g.fillPath();

    // Блик сверху-слева
    g.fillStyle(0xfff3b0, 1);
    g.fillCircle(c - 4, c - 4, 3);

    // Символ номинала
    g.fillStyle(0x8a6400, 1);
    g.fillRect(c - 1.5, c - 6, 3, 12);
    g.fillRect(c - 5, c - 6, 10, 2.5);
    g.fillRect(c - 5, c + 3.5, 10, 2.5);

    g.generateTexture(COIN_TEXTURE_KEY, COIN_SIZE, COIN_SIZE);
    g.destroy();
}

export function addCoinIcon(scene: Phaser.Scene, x: number, y: number, scale = 1): Phaser.GameObjects.Image {
    ensureCoinTexture(scene);
    return scene.add.image(x, y, COIN_TEXTURE_KEY).setScale(scale);
}
