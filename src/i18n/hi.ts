import { RU } from './ru';

// Хинди-словарь.
//
// Заметки по локализации:
// - Индийские игровые интерфейсы обычно смешивают хинди с
//   транслитерированными английскими игровыми терминами (HP, स्कोर,
//   बैलेंस, मल्टीप्लायर, अपग्रेड) — это не небрежность, а нормальная и
//   ожидаемая практика, более естественная для игрока, чем чисто
//   санскритизированные аналоги.
// - Кирка — "गैंती" (настоящее хинди-слово для кирки/мотыги, используемой
//   для копания, а не для "топора" или "лопаты"). Материал ставится ПЕРЕД
//   "गैंती" через притяжательную частицу "की" ("लोहे की गैंती" = "Железная
//   кирка"), поэтому в pickaxe.* формы стоят в правильном родительном
//   падеже (लोहे, हीरे), а не в именительном (लोहा, हीरा).
// - Предложения заканчиваются знаком "।" (данда), а не точкой — это
//   стандартный знак завершения предложения в хинди.
export const HI: Record<keyof typeof RU, string> = {
    'common.backToMenu': 'मेनू पर वापस जाएं',
    'common.max': 'MAX',
    'common.fallbackPlayerName': 'खिलाड़ी',

    'menu.title': 'खान सिम्युलेटर',
    'menu.play': 'खेलें',
    'menu.upgrade': 'अपग्रेड',
    'menu.leaders': 'लीडरबोर्ड',
    'menu.stats.balance': 'बैलेंस: {value}',
    'menu.stats.maxDepth': 'गहराई रिकॉर्ड: {value}',
    'menu.stats.totalMined': 'कुल खनन: {value}',

    'upgrade.title': 'खान: अपग्रेड',
    'upgrade.balance': 'बैलेंस: {value}',
    'upgrade.rowTitle': '{name} (Lvl {level})',
    'upgrade.buy': 'खरीदें: {cost}',
    'upgrade.hp.name': 'बेस HP (+5 HP)',
    'upgrade.dmg.name': 'बेस डैमेज (+1)',
    'upgrade.mult.name': 'स्कोर मल्टीप्लायर (+7.5%)',
    'upgrade.ore.name': 'अयस्क स्पॉन दर (+5%)',
    'upgrade.forge.name': 'फोर्ज फ़्रीक्वेंसी (+8%)',

    'hud.depth': 'गहराई: {depth}  (सर्वश्रेष्ठ: {record})',
    'hud.score': 'स्कोर: {value}',
    'hud.pickaxe': '{name} की गैंती (Lv {level})',
    'hud.damage': 'डैमेज: {value}',
    'hud.multiplier': 'मल्टीप्लायर: x{value}',
    'hud.claimBalance': 'पैसे निकालें',

    'gameover.text': 'गैंती टूट गई\nस्कोर: {score}\n[गेम खत्म करें]',
    'gameover.reviveAd': 'HP रीस्टोर करें (विज्ञापन देखें)',

    'milestone.text': 'नया रिकॉर्ड: {depth}\n+{bonus} स्कोर, +{heal} मजबूती',

    'pickaxe.wood': 'लकड़ी',
    'pickaxe.stone': 'पत्थर',
    'pickaxe.iron': 'लोहे',
    'pickaxe.diamond': 'हीरे',

    'leaderboard.title': 'लीडरबोर्ड',
    'leaderboard.subtitle': 'गहराई रिकॉर्ड के अनुसार',
    'leaderboard.loading': 'लोड हो रहा है...',
    'leaderboard.unavailable': 'लीडरबोर्ड केवल तभी उपलब्ध है\nजब गेम Yandex Games पर\nचल रहा हो',
    'leaderboard.fetchFailed': 'लीडरबोर्ड लोड नहीं हो सका।\nकृपया बाद में फिर से प्रयास करें।',
    'leaderboard.empty': 'अभी तक किसी ने खान को नहीं जीता।\nसबसे पहले आप बनें!',
    'leaderboard.yourRank': 'आपकी रैंक: {rank}',
    'leaderboard.podiumDepth': 'गहराई: {value}',
    'leaderboard.col.rank': 'रैंक',
    'leaderboard.col.player': 'खिलाड़ी',
    'leaderboard.col.depth': 'गहराई',
    'leaderboard.col.coins': 'सिक्के'
};
