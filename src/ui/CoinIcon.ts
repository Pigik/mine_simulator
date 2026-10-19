import Phaser from 'phaser';

// Раньше рядом с числом монет ставился эмодзи 💰 — рендерится системным
// эмодзи-шрифтом и выбивается из пиксель-арта. Вместо него — маленькая
// процедурная иконка монеты (та же техника, что у кнопок: Graphics ->
// generateTexture), сгенерированная один раз и переиспользуемая везде.
const COIN_TEXTURE_KEY = 'ui_coin_icon';
const COIN_SIZE = 22;

function ensureCoinTexture(scene: Phaser.Scene) {
    if (scene.textures.exists(COIN_TEXTURE_KEY)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });
    const c = COIN_SIZE / 2;

    // Тёмный контур монеты
    g.fillStyle(0x4a3200, 1);
    g.fillCircle(c, c, c);

    // Основная золотая заливка (чуть меньше контура)
    g.fillStyle(0xffd700, 1);
    g.fillCircle(c, c, c - 2);

    // Тень снизу-справа для объёма
    g.fillStyle(0xd4af00, 1);
    g.slice(c, c, c - 2, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(165), false);
    g.fillPath();

    // Блик сверху-слева
    g.fillStyle(0xfff3b0, 1);
    g.fillCircle(c - 4, c - 4, 3);

    // Символ номинала по центру, чтобы монета читалась именно как деньги
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

export function coinTextureKey(scene: Phaser.Scene): string {
    ensureCoinTexture(scene);
    return COIN_TEXTURE_KEY;
}
