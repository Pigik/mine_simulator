import Phaser from 'phaser';

// Единая палитра и текстовые стили для всего UI игры. Цели:
// 1) Все панели/карточки/HUD используют ту же "каменную" технику, что и
//    кнопки (StoneButton), а не собственный плоский стиль.
// 2) Ключевые цифры (баланс, счёт, глубина) всегда жирные и с толстой
//    обводкой, чтобы не терялись на фоне ("тонкий шрифт" из старой версии).

export interface BevelColors {
    border: number;
    base: number;
    hi: number;
    sh: number;
}

// Ровно те цвета, что были у кнопок изначально — ничего в их виде не меняем,
// просто выносим в общее место, чтобы панели могли использовать то же самое.
export const STONE_COLORS: Record<'idle' | 'hover' | 'down' | 'disabled', BevelColors> = {
    idle: { border: 0x0c0c0c, base: 0x7c7c7c, hi: 0xdedede, sh: 0x3a3a3a },
    hover: { border: 0x0c0c0c, base: 0x8f8f8f, hi: 0xf2f2f2, sh: 0x454545 },
    down: { border: 0x0c0c0c, base: 0x666666, hi: 0x4d4d4d, sh: 0x8f8f8f },
    disabled: { border: 0x0c0c0c, base: 0x4a4a4a, hi: 0x5c5c5c, sh: 0x2c2c2c }
};

// Более тёмный и приглушённый вариант той же каменной фактуры — для
// статичных панелей (HUD, карточки, строки таблицы), чтобы они не спорили
// по яркости с интерактивными кнопками.
export const PANEL_COLORS: BevelColors = { border: 0x0a0a0a, base: 0x2b2b2b, hi: 0x474747, sh: 0x161616 };
export const PANEL_COLORS_HIGHLIGHT: BevelColors = { border: 0x0a0a0a, base: 0x33321f, hi: 0x55531f, sh: 0x1a1a10 };

export const ACCENT = {
    gold: 0xffd700,
    // Более яркий жёлтый — для апгрейдов, на которые хватает монет.
    goldBright: 0xffee58,
    // Приглушённый, тусклый золотой — для апгрейдов не по карману.
    goldDim: 0x8c7600,
    positive: 0x4caf50,
    warning: 0xffc107,
    danger: 0xe53935,
    // Настоящая "опасность" (кирка сломалась) — единственное место, где
    // красный остаётся уместным.
    dangerText: '#ff5252'
};

export const TEXT = {
    fontFamily: 'Courier',
    strokeColor: '#000000'
};

// Смешивает каждый цвет набора bevel-цветов с акцентным оттенком — так из
// серой "каменной" кнопки получается золотая/зелёная версии той же формы,
// без дублирования кода отрисовки.
export function tintBevelColors(colors: BevelColors, accent: number, amount = 0.45): BevelColors {
    const mix = (c: number) => {
        const from = Phaser.Display.Color.IntegerToColor(c);
        const to = Phaser.Display.Color.IntegerToColor(accent);
        const result = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(amount * 100));
        return Phaser.Display.Color.GetColor(result.r, result.g, result.b);
    };
    return { border: colors.border, base: mix(colors.base), hi: mix(colors.hi), sh: mix(colors.sh) };
}

// Жирный контрастный стиль для важных цифр (баланс/счёт/глубина и т.п.).
export function statTextStyle(size: string, color = '#ffffff', strokeThickness = 5): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: TEXT.fontFamily, fontSize: size, color, fontStyle: 'bold',
        stroke: TEXT.strokeColor, strokeThickness
    };
}

// Второстепенный текст (урон, тип кирки, подписи) — светлее, тоньше, не
// перетягивает внимание с главных цифр.
export function secondaryTextStyle(size: string, color = '#c8c8c8'): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: TEXT.fontFamily, fontSize: size, color };
}

// Заголовки экранов: жирный текст + "вырезанная из камня" тень (двойной
// сдвиг тёмной обводки) вместо плоской обводки, которая была раньше.
export function styleTitleText(text: Phaser.GameObjects.Text) {
    text.setShadow(3, 4, '#000000', 0, false, true);
    return text;
}
