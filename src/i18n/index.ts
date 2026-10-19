import { RU } from './ru';
import { EN } from './en';
import { TR } from './tr';
import { ZH } from './zh';
import { KO } from './ko';
import { HI } from './hi';
import { VI } from './vi';

// Локализация. Все видимые строки — ключи словарей (ru.ts и др.).
// Яндекс Игры требуют автоопределение языка и отсутствие непереведённых надписей.

export type TranslationKey = keyof typeof RU;
export type LocaleCode = 'ru' | 'en' | 'tr' | 'zh' | 'ko' | 'hi' | 'vi';

const DICTIONARIES: Record<LocaleCode, Record<TranslationKey, string>> = {
    ru: RU,
    en: EN,
    tr: TR,
    zh: ZH,
    ko: KO,
    hi: HI,
    vi: VI
};

const DEFAULT_LOCALE: LocaleCode = 'ru';

let currentLocale: LocaleCode = DEFAULT_LOCALE;

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const dict = DICTIONARIES[currentLocale] ?? DICTIONARIES[DEFAULT_LOCALE];
    const template = dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;

    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, paramName) => {
        const value = params[paramName];
        return value === undefined ? match : String(value);
    });
}

function safeNavigatorLanguage(): string | null {
    try {
        return navigator.language || null;
    } catch (e) {
        return null;
    }
}

// SDK инициализируется асинхронно (index.html), поэтому ждём window.ysdkReady.
async function readSdkLanguage(): Promise<string | null> {
    try {
        const w = window as any;
        const readyPromise: Promise<any> | undefined = w.ysdkReady;
        if (!readyPromise || typeof readyPromise.then !== 'function') return null;

        // Не ждём SDK бесконечно (например, при локальной разработке).
        const ysdk = await Promise.race([
            readyPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
        ]);

        return (ysdk && ysdk.environment && ysdk.environment.i18n && typeof ysdk.environment.i18n.lang === 'string')
            ? ysdk.environment.i18n.lang
            : null;
    } catch (e) {
        return null;
    }
}

// Языки без своего словаря откатываются на английский.
function normalizeLocale(lang: string | null): LocaleCode {
    const code = (lang ?? '').toLowerCase();
    if (code.startsWith('ru')) return 'ru';
    if (code.startsWith('tr')) return 'tr';
    if (code.startsWith('zh')) return 'zh';
    if (code.startsWith('ko')) return 'ko';
    if (code.startsWith('hi')) return 'hi';
    if (code.startsWith('vi')) return 'vi';
    return 'en';
}

// Вызывать один раз до создания Phaser.Game.
export async function detectAndSetLocale(): Promise<void> {
    const sdkLang = await readSdkLanguage();
    const lang = sdkLang ?? safeNavigatorLanguage();
    currentLocale = normalizeLocale(lang);

    try {
        document.documentElement.lang = currentLocale;
    } catch (e) { /* не критично для игры */ }
}
