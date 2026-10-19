import { RU } from './ru';

// Английский словарь — международный язык по умолчанию для любого языка
// интерфейса Яндекс Игр, для которого пока нет отдельного качественно
// вычитанного перевода (см. detectAndSetLocale в src/i18n/index.ts).
//
// Тип ниже (Record<keyof typeof RU, string>) на этапе СБОРКИ проверяет,
// что здесь переведён каждый ключ из ru.ts — забытый перевод — это ошибка
// компиляции, а не тихо непереведённая строка в игре.
//
// Переводы намеренно не дословные, а по смыслу и в терминах, привычных
// англоязычному игроку (например "CASH OUT" вместо буквального "CLAIM
// BALANCE" — устоявшийся в играх такого жанра термин для завершения
// забега с сохранением заработанного).
export const EN: Record<keyof typeof RU, string> = {
    'common.backToMenu': 'BACK TO MENU',
    'common.max': 'MAX',
    'common.fallbackPlayerName': 'Player',

    'menu.title': 'MINE SIMULATOR',
    'menu.play': 'PLAY',
    'menu.upgrade': 'UPGRADES',
    'menu.leaders': 'LEADERBOARD',
    'menu.stats.balance': 'BALANCE: {value}',
    'menu.stats.maxDepth': 'DEPTH RECORD: {value}',
    'menu.stats.totalMined': 'TOTAL MINED: {value}',

    'upgrade.title': 'MINE: UPGRADES',
    'upgrade.balance': 'BALANCE: {value}',
    'upgrade.rowTitle': '{name} (Lvl {level})',
    'upgrade.buy': 'Buy: {cost}',
    'upgrade.hp.name': 'Base HP (+5 HP)',
    'upgrade.dmg.name': 'Base damage (+1)',
    'upgrade.mult.name': 'Score multiplier (+7.5%)',
    'upgrade.ore.name': 'Ore spawn rate (+5%)',
    'upgrade.forge.name': 'Forge frequency (+8%)',

    'hud.depth': 'Depth: {depth} (Best: {record})',
    'hud.score': 'Score: {value}',
    'hud.pickaxe': 'Pickaxe: {name} (Lvl {level})',
    'hud.damage': 'Damage: {value}',
    'hud.multiplier': 'Multiplier: x{value}',
    'hud.claimBalance': 'CASH OUT',

    'gameover.text': 'PICKAXE BROKE\nSCORE: {score}\n[END RUN]',
    'gameover.reviveAd': 'RESTORE HP (WATCH AD)',

    'milestone.text': 'NEW RECORD: {depth}\n+{bonus} score, +{heal} durability',

    'pickaxe.wood': 'Wooden',
    'pickaxe.stone': 'Stone',
    'pickaxe.iron': 'Iron',
    'pickaxe.diamond': 'Diamond',

    'leaderboard.title': 'LEADERBOARD',
    'leaderboard.subtitle': 'by depth record',
    'leaderboard.loading': 'Loading...',
    'leaderboard.unavailable': 'The leaderboard is only available\nwhen the game is running\non Yandex Games',
    'leaderboard.fetchFailed': 'Could not load the leaderboard.\nPlease try again later.',
    'leaderboard.empty': 'No one has conquered the mine yet.\nBe the first!',
    'leaderboard.yourRank': 'YOUR RANK: {rank}',
    'leaderboard.podiumDepth': 'Depth: {value}',
    'leaderboard.col.rank': 'RANK',
    'leaderboard.col.player': 'PLAYER',
    'leaderboard.col.depth': 'DEPTH',
    'leaderboard.col.coins': 'COINS'
};
