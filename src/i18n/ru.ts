// Русские строки — исходный (основной) язык интерфейса игры.
//
// Этот файл определяет ПОЛНЫЙ набор ключей локализации: словари остальных
// языков (см. en.ts) типизированы как Record<keyof typeof RU, string> —
// если забыть перевести хотя бы один ключ, TypeScript откажется собирать
// проект, вместо того чтобы молча показать в игре непереведённую строку
// (см. требование Яндекс Игр: "непереведённых надписей быть не должно,
// даже мелких").
//
// {имяПараметра} — место подстановки значения через t(key, { имяПараметра: ... }),
// см. src/i18n/index.ts.
export const RU = {
    'common.backToMenu': 'НАЗАД В МЕНЮ',
    'common.max': 'MAX',
    'common.fallbackPlayerName': 'Игрок',

    'menu.title': 'СИМУЛЯТОР ШАХТЫ',
    'menu.play': 'ИГРАТЬ',
    'menu.upgrade': 'ПРОКАЧКА',
    'menu.leaders': 'ЛИДЕРЫ',
    'menu.stats.balance': 'БАЛАНС: {value}',
    'menu.stats.maxDepth': 'РЕКОРД ГЛУБИНЫ: {value}',
    'menu.stats.totalMined': 'ВСЕГО ДОБЫТО: {value}',

    'upgrade.title': 'ШАХТА: УЛУЧШЕНИЯ',
    'upgrade.balance': 'БАЛАНС: {value}',
    'upgrade.rowTitle': '{name} (Ур. {level})',
    'upgrade.buy': 'Купить: {cost}',
    'upgrade.hp.name': 'Базовое HP (+5 HP)',
    'upgrade.dmg.name': 'Базовый урон (+1)',
    'upgrade.mult.name': 'Множитель очков (+7.5%)',
    'upgrade.ore.name': 'Частота спавна руд (+5%)',
    'upgrade.forge.name': 'Частота кузниц (+8%)',

    'hud.depth': 'Глубина: {depth}  (Рекорд: {record})',
    'hud.score': 'Счёт: {value}',
    'hud.pickaxe': 'Кирка: {name} (Ур. {level})',
    'hud.damage': 'Урон: {value}',
    'hud.multiplier': 'Множитель: x{value}',
    'hud.claimBalance': 'ЗАБРАТЬ БАЛАНС',

    'gameover.text': 'КИРКА СЛОМАЛАСЬ\nСЧЁТ: {score}\n[ЗАВЕРШИТЬ ИГРУ]',
    'gameover.reviveAd': 'ВОССТАНОВИТЬ HP (РЕКЛАМА)',

    'milestone.text': 'НОВЫЙ РЕКОРД: {depth}\n+{bonus} очков, +{heal} прочности',

    'pickaxe.wood': 'Деревянная',
    'pickaxe.stone': 'Каменная',
    'pickaxe.iron': 'Железная',
    'pickaxe.diamond': 'Алмазная',

    'leaderboard.title': 'ТАБЛИЦА ЛИДЕРОВ',
    'leaderboard.subtitle': 'по рекордной глубине',
    'leaderboard.loading': 'Загрузка...',
    'leaderboard.unavailable': 'Таблица лидеров доступна\nтолько при запуске игры\nна Яндекс Играх',
    'leaderboard.fetchFailed': 'Не удалось загрузить таблицу лидеров.\nПопробуйте зайти позже.',
    'leaderboard.empty': 'Пока никто не покорил шахту.\nСтаньте первым!',
    'leaderboard.yourRank': 'ВАШЕ МЕСТО: {rank}',
    'leaderboard.podiumDepth': 'Глубина: {value}',
    'leaderboard.col.rank': 'МЕСТО',
    'leaderboard.col.player': 'ИГРОК',
    'leaderboard.col.depth': 'ГЛУБИНА',
    'leaderboard.col.coins': 'МОНЕТ'
} as const;
