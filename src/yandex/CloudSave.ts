// Сохранение прогресса: localStorage + облако Яндекс Игр (ysdk.player).
// Яндекс Игры требуют, чтобы прогресс переносился между устройствами.
//
// - initCloudSave() один раз при старте ждёт SDK и читает облако в cache;
//   дальше SaveSystem.load()/save() работают синхронно с cache.
// - save() пишет в localStorage сразу и в облако в фоне.
// - Вне Яндекс Игр работает только localStorage.
// - Если в облаке пусто, а локально прогресс есть — он отправляется в облако.
//   Если в облаке прогресс есть — он в приоритете.
import { waitForYsdk } from './sdk';

export interface PlayerData {
    balance: number;
    lvlHp: number;
    lvlMult: number;
    lvlOre: number;
    lvlDamage: number;
    // Уровень прокачки частоты кузниц. Имя поля осталось от "верстака",
    // не переименовано, чтобы не сломать существующие сохранения.
    lvlBench: number;
    maxDepth: number;
    // Монет добыто за всю игру (не уменьшается при тратах). Для таблицы лидеров.
    totalCoinsMined: number;
}

// Один ключ и для localStorage, и для player.setData/getData.
const STORAGE_KEY = 'miner_save';

function emptyPlayerData(): PlayerData {
    return { balance: 0, lvlHp: 0, lvlMult: 0, lvlOre: 0, lvlDamage: 0, lvlBench: 0, maxDepth: 0, totalCoinsMined: 0 };
}

// Некорректные или отсутствующие поля заменяются значениями по умолчанию.
function normalize(parsed: any): PlayerData {
    const data = emptyPlayerData();
    if (!parsed || typeof parsed !== 'object') return data;

    if (typeof parsed.balance === 'number') data.balance = parsed.balance;
    if (typeof parsed.lvlHp === 'number') data.lvlHp = parsed.lvlHp;
    if (typeof parsed.lvlMult === 'number') data.lvlMult = parsed.lvlMult;
    if (typeof parsed.lvlOre === 'number') data.lvlOre = parsed.lvlOre;
    if (typeof parsed.lvlDamage === 'number') data.lvlDamage = parsed.lvlDamage;
    if (typeof parsed.lvlBench === 'number') data.lvlBench = parsed.lvlBench;
    if (typeof parsed.maxDepth === 'number') data.maxDepth = parsed.maxDepth;
    if (typeof parsed.totalCoinsMined === 'number') data.totalCoinsMined = parsed.totalCoinsMined;

    return data;
}

function loadLocal(): PlayerData | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? normalize(JSON.parse(raw)) : null;
    } catch (e) {
        return null;
    }
}

function saveLocal(data: PlayerData): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* localStorage недоступен */ }
}

// Текущий прогресс. Сразу заполняется из localStorage, до initCloudSave().
let cache: PlayerData = loadLocal() ?? emptyPlayerData();

// Player из SDK; null вне Яндекс Игр.
let cloudPlayer: any | null = null;

async function loadCloud(): Promise<PlayerData | null> {
    try {
        // SDK инициализируется асинхронно, без ожидания облако не подключится.
        const ysdk = await waitForYsdk();
        if (!ysdk || typeof ysdk.getPlayer !== 'function') return null;

        cloudPlayer = await ysdk.getPlayer().catch(() => null);
        if (!cloudPlayer || typeof cloudPlayer.getData !== 'function') return null;

        const remote = await cloudPlayer.getData([STORAGE_KEY]);
        return remote && remote[STORAGE_KEY] ? normalize(remote[STORAGE_KEY]) : null;
    } catch (e) {
        console.warn('CloudSave: не удалось прочитать данные игрока из SDK Яндекс Игр:', e);
        return null;
    }
}

// Вызывать один раз до создания Phaser.Game.
export async function initCloudSave(): Promise<void> {
    const localData = cache;
    const remoteData = await loadCloud();

    if (remoteData) {
        cache = remoteData;
        saveLocal(cache);
    } else if (cloudPlayer) {
        // В облаке пусто — отправляем туда локальный прогресс.
        pushToCloud(localData);
    }
}

let pendingPush: PlayerData | null = null;
let pushInFlight = false;

// Фоновая отправка в облако. Пока идёт запрос, новые данные ждут в pendingPush,
// чтобы старые данные не перезаписали более новые.
function pushToCloud(data: PlayerData): void {
    if (!cloudPlayer || typeof cloudPlayer.setData !== 'function') return;

    pendingPush = data;
    if (pushInFlight) return;

    (async () => {
        pushInFlight = true;
        while (pendingPush) {
            const toSend = pendingPush;
            pendingPush = null;
            try {
                // flush: false — SDK отправит пачкой, чтобы не упереться в лимит запросов.
                await cloudPlayer.setData({ [STORAGE_KEY]: toSend }, false);
            } catch (e) {
                console.warn('CloudSave: не удалось отправить данные игрока в SDK Яндекс Игр:', e);
            }
        }
        pushInFlight = false;
    })();
}

// При уходе со страницы отправляем последнее сохранение сразу (flush: true).
function flushCloud(): void {
    try {
        if (cloudPlayer && typeof cloudPlayer.setData === 'function') {
            cloudPlayer.setData({ [STORAGE_KEY]: cache }, true);
        }
    } catch (e) { /* не критично */ }
}

try {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushCloud();
    });
} catch (e) { /* не критично */ }

export const SaveSystem = {
    // Возвращает копию, чтобы изменения не попадали в cache без save().
    load(): PlayerData {
        return { ...cache };
    },
    save(data: PlayerData): void {
        cache = { ...data };
        saveLocal(cache);
        pushToCloud(cache);
    }
};
