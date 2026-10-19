// Лидерборд Яндекс Игр.
// В консоли разработчика нужен лидерборд "depth_leaderboard":
// числовой, сортировка по убыванию (рекордная глубина).
// Монеты за всю игру хранятся в extraData и в сортировке не участвуют.

import { t } from '../i18n';

export const LEADERBOARD_NAME = 'depth_leaderboard';

function getYsdk(): any | null {
    const w = window as any;
    return (typeof w.ysdk !== 'undefined' && w.ysdk !== null) ? w.ysdk : null;
}

// Не бросает исключений: если SDK недоступен или игрок не авторизован, ничего не делает.
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
    // false — SDK недоступен.
    available: boolean;
    rows: LeaderboardRow[];
    // Место игрока, даже если он не в топе.
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
