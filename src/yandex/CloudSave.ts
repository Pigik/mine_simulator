// Облачное сохранение прогресса через SDK Яндекс Игр (ysdk.player.*) —
// вместо (точнее, в дополнение к) localStorage.
//
// Требование Яндекс Игр (см. https://yandex.ru/dev/games/doc/ru/sdk/sdk-player
// и критерии модерации): прогресс должен переноситься между устройствами и
// браузерами. localStorage привязан к конкретному браузеру на конкретном
// устройстве и для этого не подходит — нужны серверные данные игрока
// (player.getData()/setData()).
//
// Архитектура:
// - При старте игры (см. initCloudSave(), вызывается из main.ts ДО создания
//   Phaser.Game — по тому же принципу, что и detectAndSetLocale в src/i18n)
//   мы ОДИН РАЗ дожидаемся готовности SDK и пытаемся прочитать
//   player.getData(). Результат кладётся в cache — дальше SaveSystem.load()/
//   save() работают синхронно с этим cache, без await в каждой сцене: сцены
//   и раньше ожидали синхронный SaveSystem (см. MainMenuScene/UpgradeScene/
//   GameScene.saveRunResults), переписывать их под async было бы намного
//   более рискованной переделкой, чем кажется на первый взгляд.
// - localStorage остаётся как быстрый локальный кэш и запасной вариант:
//   SaveSystem.save() пишет синхронно в localStorage (мгновенно, не
//   теряется, даже если вкладку закрыли раньше, чем успел отработать
//   сетевой запрос к SDK) и параллельно, в фоне, отправляет те же данные в
//   ysdk.player.setData() — не блокируя игру и не бросая исключений наружу,
//   как и остальные обёртки над SDK в этой папке (см. Leaderboard.ts,
//   GameplayApi.ts).
// - Если игра запущена не на Яндекс Играх (локальная разработка) или
//   player.* недоступен — всё тихо откатывается на чистый localStorage,
//   поведение не отличается от того, что было раньше.
// - Миграция существующих сохранений: если на этом устройстве уже есть
//   локальный прогресс (localStorage), а в облаке для этого игрока данных
//   ещё нет (первый запуск после обновления игры либо новый игрок) —
//   используем локальный прогресс как основу и сразу отправляем его в
//   облако, чтобы ничего не потерять. Если в облаке прогресс УЖЕ есть — он
//   в приоритете: это именно тот случай, когда игрок продолжает на новом
//   устройстве/браузере, ради которого всё и делается.

export interface PlayerData {
    balance: number;
    lvlHp: number;
    lvlMult: number;
    lvlOre: number;
    lvlDamage: number;
    // Частота встречи верстаков в шахте (см. GAME_CONFIG.BENCH_BONUS_PER_UPGRADE
    // в GameScene) — верстак поднимает уровень кирки, поэтому чаще встречать
    // их выгодно, но эффект намеренно небольшой и с потолком.
    lvlBench: number;
    maxDepth: number;
    // Сколько монет добыто за ВСЮ игру суммарно (никогда не уменьшается, в
    // отличие от balance, который тратится на прокачку). Используется для
    // колонки "всего монет" в таблице лидеров.
    totalCoinsMined: number;
}

// Единый ключ и для localStorage, и для player.setData/getData — так
// сохранение выглядит как один namespaced объект, а не разбросанные по
// облаку отдельные поля (на будущее, если к данным игрока добавится что-то
// ещё, не связанное с PlayerData).
const STORAGE_KEY = 'miner_save';

function emptyPlayerData(): PlayerData {
    return { balance: 0, lvlHp: 0, lvlMult: 0, lvlOre: 0, lvlDamage: 0, lvlBench: 0, maxDepth: 0, totalCoinsMined: 0 };
}

// Аккуратно достраивает PlayerData из произвольного объекта (из
// localStorage или из облака) — отсутствующие/некорректные поля заменяются
// значениями по умолчанию, а не протаскиваются как undefined/NaN дальше в
// игру (см. аналогичную защиту в старом SaveSystem.load()).
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
        // Приватный режим браузера / localStorage отключён — не критично,
        // просто играем без локального кэша (облако, если доступно, всё
        // равно отработает).
        return null;
    }
}

function saveLocal(data: PlayerData): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* недоступно (приватный режим/квота) — останется облачная копия, если SDK доступен */ }
}

function getYsdk(): any | null {
    const w = window as any;
    return (typeof w.ysdk !== 'undefined' && w.ysdk !== null) ? w.ysdk : null;
}

// Текущее состояние прогресса — единственный источник правды для
// SaveSystem.load()/save() (см. низ файла). Инициализируется синхронно из
// localStorage сразу при импорте модуля, чтобы код, который по ошибке
// вызовет SaveSystem.load() до initCloudSave(), всё равно получил
// разумные данные, а не пустышку посреди забега.
let cache: PlayerData = loadLocal() ?? emptyPlayerData();

// Объект Player из SDK Яндекс Игр, если удалось его получить — используется
// дальше для setData() при каждом сохранении. null, если SDK недоступен
// (локальная разработка) или игра запущена не на Яндекс Играх.
let cloudPlayer: any | null = null;

async function loadCloud(): Promise<PlayerData | null> {
    try {
        const ysdk = getYsdk();
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

// Вызывать РОВНО ОДИН РАЗ при старте игры (см. main.ts), ДО создания
// Phaser.Game — по тому же принципу, что и detectAndSetLocale: первая же
// сцена должна увидеть уже актуальный прогресс, а не временно пустой, с
// "миганием" после того, как облачные данные подъедут с опозданием.
export async function initCloudSave(): Promise<void> {
    const localData = cache;
    const remoteData = await loadCloud();

    if (remoteData) {
        // В облаке уже есть сохранение — оно в приоритете. Именно ради
        // этого случая всё и делалось: игрок продолжает на новом
        // устройстве/браузере, где localStorage пустой или устаревший.
        cache = remoteData;
        saveLocal(cache);
    } else if (cloudPlayer) {
        // SDK доступен, но в облаке под этим ключом пока ничего нет — либо
        // совсем новый игрок, либо это первый запуск после обновления
        // игры (раньше сохранялись только в localStorage). В обоих случаях
        // используем то, что уже накоплено локально (пусто для нового
        // игрока, прогресс — для старого), и сразу отправляем в облако,
        // чтобы не потерять его при следующем запуске на другом устройстве.
        pushToCloud(localData);
    }
    // Если cloudPlayer так и не получился (SDK недоступен/не на Яндекс
    // Играх) — ничего не делаем, остаёмся на чистом localStorage, как и
    // раньше.
}

let pendingPush: PlayerData | null = null;
let pushInFlight = false;

// Отправка в SDK — не блокирует вызывающий код и не бросает исключений
// наружу (как и submitScore в Leaderboard.ts). Если в момент вызова уже
// идёт другая отправка, новые данные запоминаются в pendingPush и
// отправляются следом, сразу после того как текущий запрос закончится —
// так более новые данные никогда не перезаписываются в облаке более
// старыми, которые всё ещё летели к серверу.
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
                // flush: false — данные уходят пачкой по расписанию самого
                // SDK, а не отдельным запросом на каждое сохранение (apгрейды
                // покупаются быстро один за другим — слать на каждый клик
                // независимый запрос было бы расточительно и могло бы
                // упереться в лимит запросов). Мгновенная отправка
                // подстрахована отдельно — см. flushCloud() ниже.
                await cloudPlayer.setData({ [STORAGE_KEY]: toSend }, false);
            } catch (e) {
                console.warn('CloudSave: не удалось отправить данные игрока в SDK Яндекс Игр:', e);
            }
        }
        pushInFlight = false;
    })();
}

// Принудительно отправляет САМОЕ ПОСЛЕДНЕЕ сохранение на сервер Яндекс Игр,
// не дожидаясь обычной пакетной отправки SDK — вызывается при уходе со
// страницы (см. подписку ниже), где важно не потерять самые последние
// данные. В остальных случаях (см. pushToCloud выше) flush не форсируем,
// чтобы не упираться в лимит частоты запросов SDK.
function flushCloud(): void {
    try {
        if (cloudPlayer && typeof cloudPlayer.setData === 'function') {
            cloudPlayer.setData({ [STORAGE_KEY]: cache }, true);
        }
    } catch (e) { /* не критично — localStorage уже сохранён синхронно в SaveSystem.save() */ }
}

try {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushCloud();
    });
} catch (e) { /* не критично для игры (например, окружение без document) */ }

export const SaveSystem = {
    // Возвращает КОПИЮ текущего прогресса (как и раньше возвращал свежий
    // JSON.parse из localStorage) — вызывающий код волен мутировать
    // результат, это не должно незаметно менять cache до явного save().
    load(): PlayerData {
        return { ...cache };
    },
    save(data: PlayerData): void {
        cache = { ...data };
        saveLocal(cache); // мгновенно и локально — не теряется, даже если вкладку закроют раньше ответа сервера
        pushToCloud(cache); // в фоне, в SDK Яндекс Игр — чтобы прогресс переносился между устройствами/браузерами
    }
};
