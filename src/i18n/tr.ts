import { RU } from './ru';

// Турецкий. Знак % ставится перед числом, разделитель дробей — запятая (%7,5).
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
