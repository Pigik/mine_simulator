import { RU } from './ru';

// Турецкий словарь.
//
// Заметки по локализации (чтобы не потерять контекст при будущих правках):
// - Проценты в турецком пишутся знаком % ПЕРЕД числом ("%7,5", "%5"), а
//   десятичный разделитель — запятая, а не точка ("%7,5", не "%7.5").
// - "Lv." для уровня — устоявшееся заимствование, используется в турецких
//   играх так же часто, как и в английских (полное "Seviye" тоже
//   встречается, но "Lv." короче и не режет глаз).
// - Валюта во всех местах называется "ALTIN" (золото) — стандартный для
//   турецких мобильных игр термин для игровой валюты, соответствует
//   значку монеты в интерфейсе лучше, чем более "банковское" "BAKİYE".
// - Кирка/материалы — термины, привычные турецким игрокам по жанру майнинг-
//   игр (Kazma = кирка, материал ставится ПЕРЕД словом "Kazma": "Elmas Kazma"
//   = "Алмазная кирка").
// - "Ocak" (очаг/горн) — естественный турецкий термин для кузницы, где
//   улучшается кирка, понятнее прямого заимствования.
export const TR: Record<keyof typeof RU, string> = {
    'common.backToMenu': 'MENÜYE DÖN',
    'common.max': 'MAX',
    'common.fallbackPlayerName': 'Oyuncu',

    'menu.title': 'MADEN SİMÜLATÖRÜ',
    'menu.play': 'OYNA',
    'menu.upgrade': 'GELİŞTİRMELER',
    'menu.leaders': 'LİDERLİK TABLOSU',
    'menu.stats.balance': 'ALTIN: {value}',
    'menu.stats.maxDepth': 'DERİNLİK REKORU: {value}',
    'menu.stats.totalMined': 'TOPLAM KAZILAN: {value}',

    'upgrade.title': 'MADEN: GELİŞTİRMELER',
    'upgrade.balance': 'ALTIN: {value}',
    'upgrade.rowTitle': '{name} (Lv. {level})',
    'upgrade.buy': 'Satın Al: {cost}',
    'upgrade.hp.name': 'Temel Can (+5 Can)',
    'upgrade.dmg.name': 'Temel Hasar (+1)',
    'upgrade.mult.name': 'Puan Çarpanı (+%7,5)',
    'upgrade.ore.name': 'Cevher Yayılma Oranı (+%5)',
    'upgrade.forge.name': 'Ocak Sıklığı (+%8)',

    'hud.depth': 'Derinlik: {depth}  (Rekor: {record})',
    'hud.score': 'Puan: {value}',
    'hud.pickaxe': '{name} Kazma (Lv. {level})',
    'hud.damage': 'Hasar: {value}',
    'hud.multiplier': 'Çarpan: x{value}',
    'hud.claimBalance': 'PARAYI ÇEK',

    'gameover.text': 'KAZMA KIRILDI\nPUAN: {score}\n[OYUNU BİTİR]',
    'gameover.reviveAd': 'CANI YENİLE (REKLAM İZLE)',

    'milestone.text': 'YENİ REKOR: {depth}\n+{bonus} puan, +{heal} dayanıklılık',

    'pickaxe.wood': 'Ahşap',
    'pickaxe.stone': 'Taş',
    'pickaxe.iron': 'Demir',
    'pickaxe.diamond': 'Elmas',

    'leaderboard.title': 'LİDERLİK TABLOSU',
    'leaderboard.subtitle': 'derinlik rekoruna göre',
    'leaderboard.loading': 'Yükleniyor...',
    'leaderboard.unavailable': 'Liderlik tablosu yalnızca\noyun Yandex Games üzerinde\nçalışırken kullanılabilir',
    'leaderboard.fetchFailed': 'Liderlik tablosu yüklenemedi.\nLütfen daha sonra tekrar deneyin.',
    'leaderboard.empty': 'Henüz kimse madeni fethetmedi.\nİlk sen ol!',
    'leaderboard.yourRank': 'SIRALAMANIZ: {rank}',
    'leaderboard.podiumDepth': 'Derinlik: {value}',
    'leaderboard.col.rank': 'SIRA',
    'leaderboard.col.player': 'OYUNCU',
    'leaderboard.col.depth': 'DERİNLİK',
    'leaderboard.col.coins': 'ALTIN'
};
