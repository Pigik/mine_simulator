import Phaser from 'phaser';

// Общая палитра и текстовые стили UI.

export interface BevelColors {
    border: number;
    base: number;
    hi: number;
    sh: number;
}

export const STONE_COLORS: Record<'idle' | 'hover' | 'down' | 'disabled', BevelColors> = {
    idle: { border: 0x0c0c0c, base: 0x7c7c7c, hi: 0xdedede, sh: 0x3a3a3a },
    hover: { border: 0x0c0c0c, base: 0x8f8f8f, hi: 0xf2f2f2, sh: 0x454545 },
    down: { border: 0x0c0c0c, base: 0x666666, hi: 0x4d4d4d, sh: 0x8f8f8f },
    disabled: { border: 0x0c0c0c, base: 0x4a4a4a, hi: 0x5c5c5c, sh: 0x2c2c2c }
};

// Тёмный вариант для статичных панелей, чтобы не спорили с кнопками.
export const PANEL_COLORS: BevelColors = { border: 0x0a0a0a, base: 0x2b2b2b, hi: 0x474747, sh: 0x161616 };
export const PANEL_COLORS_HIGHLIGHT: BevelColors = { border: 0x0a0a0a, base: 0x33321f, hi: 0x55531f, sh: 0x1a1a10 };

export const ACCENT = {
    gold: 0xffd700,
    // апгрейд по карману
    goldBright: 0xffee58,
    // апгрейд не по карману
    goldDim: 0x8c7600,
    positive: 0x4caf50,
    warning: 0xffc107,
    danger: 0xe53935,
    dangerText: '#ff5252'
};

export const TEXT = {
    fontFamily: 'Courier',
    strokeColor: '#000000'
};

// Подмешивает акцентный цвет к каменной палитре (золотая/зелёная кнопка той же формы).
export function tintBevelColors(colors: BevelColors, accent: number, amount = 0.45): BevelColors {
    const mix = (c: number) => {
        const from = Phaser.Display.Color.IntegerToColor(c);
        const to = Phaser.Display.Color.IntegerToColor(accent);
        const result = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(amount * 100));
        return Phaser.Display.Color.GetColor(result.r, result.g, result.b);
    };
    return { border: colors.border, base: mix(colors.base), hi: mix(colors.hi), sh: mix(colors.sh) };
}

// Жирный стиль для важных цифр (баланс, счёт, глубина).
export function statTextStyle(size: string, color = '#ffffff', strokeThickness = 5): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: TEXT.fontFamily, fontSize: size, color, fontStyle: 'bold',
        stroke: TEXT.strokeColor, strokeThickness
    };
}

export function secondaryTextStyle(size: string, color = '#c8c8c8'): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: TEXT.fontFamily, fontSize: size, color };
}

export function styleTitleText(text: Phaser.GameObjects.Text) {
    text.setShadow(3, 4, '#000000', 0, false, true);
    return text;
}
