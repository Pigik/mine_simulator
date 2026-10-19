import { RU } from './ru';
import { EN } from './en';
import { TR } from './tr';
import { ZH } from './zh';
import { KO } from './ko';
import { HI } from './hi';
import { VI } from './vi';

// Требование Яндекс Игр (см. https://yandex.ru/dev/games/doc/ru/concepts/requirements
// и критерии модерации): "встроено автоопределение языка через SDK",
// "непереведённых надписей быть не должно, даже мелких".
//
// Архитектура: каждая видимая строка в игре — это ключ словаря (см.
// ru.ts/en.ts/tr.ts/zh.ts/ko.ts/hi.ts/vi.ts), а не хардкод в самой сцене.
// t(key, params) достаёт строку для ТЕКУЩЕГО определённого языка и
// подставляет параметры вида {name}. Так исключается сам класс ошибки
// "забыли перевести один текст" — если строка не вынесена в словарь, она
// просто не появится на экране, а если её забыли перевести в одном из
// словарей — TypeScript откажется собирать проект (см. комментарий в
// en.ts).

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

// Язык по умолчанию до завершения детекта (см. detectAndSetLocale) — тот
// же, на котором изначально был написан весь текст игры. Разумный запасной
// вариант, если детект вообще не отработает (см. try/catch ниже).
const DEFAULT_LOCALE: LocaleCode = 'ru';

let currentLocale: LocaleCode = DEFAULT_LOCALE;

export function getLocale(): LocaleCode {
    return currentLocale;
}

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

// SDK Яндекс Игр инициализируется асинхронно (см. index.html), поэтому
// window.ysdk в момент запуска main.ts ещё может быть null — ждём именно
// промис его готовности (window.ysdkReady), а не опрашиваем в цикле.
async function readSdkLanguage(): Promise<string | null> {
    try {
        const w = window as any;
        const readyPromise: Promise<any> | undefined = w.ysdkReady;
        if (!readyPromise || typeof readyPromise.then !== 'function') return null;

        // Не блокируем запуск игры навсегда, если SDK Яндекс Игр по
        // какой-то причине не отвечает (например, локальная разработка вне
        // платформы, без доступа к yandex.ru) — ограничиваем ожидание
        // разумным таймаутом и просто откатываемся на язык браузера.
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

// У нас сейчас 7 готовых, вручную вычитанных словарей — русский,
// международный английский и ещё пять языков, рекомендованных Яндекс Играми
// для более широкого охвата аудитории: турецкий, китайский (упрощённый),
// корейский, хинди и вьетнамский (см. ru.ts/en.ts/tr.ts/zh.ts/ko.ts/hi.ts/
// vi.ts). Яндекс Игры поддерживают ещё больше языков интерфейса (см.
// environment.i18n.lang в формате ISO 639-1), но рисковать неточным/
// неоднозначным переводом для языка, который толком некому вычитать, хуже,
// чем показать международный английский — поэтому любой язык вне этого
// списка из семи сознательно откатывается на английский, а не пытается
// угадать ближайший похожий словарь.
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

// Вызывать РОВНО ОДИН РАЗ, до создания Phaser.Game (см. main.ts) — чтобы
// уже самый первый кадр главного меню отрисовался на правильном языке, без
// "мелькания" не того текста при последующем определении языка.
export async function detectAndSetLocale(): Promise<void> {
    const sdkLang = await readSdkLanguage();
    const lang = sdkLang ?? safeNavigatorLanguage();
    currentLocale = normalizeLocale(lang);

    try {
        document.documentElement.lang = currentLocale;
    } catch (e) { /* не критично для игры */ }
}
