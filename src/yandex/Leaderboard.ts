// Обёртка над лидербордами Яндекс Игр (SDK v2, ysdk.leaderboards.*).
// См. https://yandex.com/dev/games/doc/en/sdk/sdk-leaderboard
//
// ВАЖНО: в консоли разработчика Яндекс Игр нужно создать лидерборд с
// технич. именем ровно "depth_leaderboard" (см. LEADERBOARD_NAME ниже),
// тип — числовой (numeric), сортировка — по убыванию (больше = лучше),
// т.к. мы кладём туда рекордную глубину игрока.
//
// Сортировка на самой платформе Яндекса всегда идёт только по score (то
// есть по глубине) — это ограничение самой платформы, а не наше решение.
// Суммарное количество добытых монет мы отдельно кладём в поле extraData
// у той же записи и просто показываем его рядом с глубиной в UI, не
// участвуя в сортировке.

import { t } from '../i18n';

export const LEADERBOARD_NAME = 'depth_leaderboard';

function getYsdk(): any | null {
    const w = window as any;
    return (typeof w.ysdk !== 'undefined' && w.ysdk !== null) ? w.ysdk : null;
}

// Отправка результата забега в лидерборд. Вызывать после сохранения
// прогресса (см. GameScene.saveRunResults). Ничего не блокирует и не
// бросает исключений наружу — если платформа недоступна, игрок не
// авторизован или лимит запросов исчерпан, просто тихо ничего не делаем.
export function submitScore(depth: number, totalCoinsMined: number): void {
    const ysdk = getYsdk();
    if (!ysdk || !ysdk.leaderboards || depth <= 0) return;

    (async () => {
        try {
            if (typeof ysdk.isAvailableMethod === 'function') {
                const ok = await ysdk.isAvailableMethod('leaderboards.setScore').catch(() => true);
                if (ok === false) return;
            }
            const player = await ysdk.getPlayer().catch(() => null);
            if (!player || !player.isAuthorized || !player.isAuthorized()) return;

            await ysdk.leaderboards.setScore(LEADERBOARD_NAME, Math.floor(depth), String(Math.floor(totalCoinsMined)));
        } catch (e) {
            console.warn('Leaderboard submitScore failed:', e);
        }
    })();
}

export interface LeaderboardRow {
    rank: number;
    name: string;
    avatarUrl: string | null;
    depth: number;
    totalCoins: number;
    isCurrentUser: boolean;
}

export interface LeaderboardResult {
    // false — SDK Яндекс Игр недоступен вовсе (например, локальная разработка).
    available: boolean;
    rows: LeaderboardRow[];
    // Место текущего игрока по данным платформы, если он авторизован
    // (может быть вне списка rows, если он не попал в топ).
    currentUserRank: number | null;
    errorReason?: string;
}

export async function fetchLeaderboard(quantityTop: number = 10): Promise<LeaderboardResult> {
    const ysdk = getYsdk();
    if (!ysdk || !ysdk.leaderboards) {
        return { available: false, rows: [], currentUserRank: null, errorReason: 'not_yandex' };
    }

    try {
        const [entriesResult, player] = await Promise.all([
            ysdk.leaderboards.getEntries(LEADERBOARD_NAME, {
                includeUser: true,
                quantityTop: Math.max(1, Math.min(20, quantityTop))
            }),
            ysdk.getPlayer().catch(() => null)
        ]);

        const myId: string | null = player && player.getUniqueID ? player.getUniqueID() : null;

        const rows: LeaderboardRow[] = (entriesResult.entries || []).map((entry: any): LeaderboardRow => {
            let totalCoins = parseInt(entry.extraData, 10);
            if (!isFinite(totalCoins) || isNaN(totalCoins)) totalCoins = 0;

            let avatarUrl: string | null = null;
            try {
                avatarUrl = entry.player && typeof entry.player.getAvatarSrc === 'function'
                    ? entry.player.getAvatarSrc('medium')
                    : null;
            } catch (e) { avatarUrl = null; }

            return {
                rank: entry.rank,
                name: (entry.player && entry.player.publicName) || t('common.fallbackPlayerName'),
                avatarUrl,
                depth: entry.score,
                totalCoins,
                isCurrentUser: !!myId && entry.player && entry.player.uniqueID === myId
            };
        });

        return {
            available: true,
            rows,
            currentUserRank: typeof entriesResult.userRank === 'number' ? entriesResult.userRank : null
        };
    } catch (e) {
        console.warn('Leaderboard fetchLeaderboard failed:', e);
        return { available: true, rows: [], currentUserRank: null, errorReason: 'fetch_failed' };
    }
}
