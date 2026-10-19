import { RU } from './ru';

// Вьетнамский словарь.
//
// Заметки по локализации:
// - Десятичный разделитель — запятая, а не точка ("7,5%", не "7.5%"), это
//   стандарт для вьетнамского языка (в отличие от английского/хинди).
// - Валюта переведена как "XU" (мелкая монета — обычное название игровой
//   валюты во вьетнамских играх) везде, включая "баланс", а не более
//   "банковское" по звучанию "Số Dư" — в игровом контексте это звучит
//   естественнее и подряд соответствует значку монеты в интерфейсе.
// - Кирка/материалы — термины, привычные вьетнамским игрокам по жанру
//   майнинг-игр (Cuốc = кирка, слово стоит ПЕРЕД материалом: "Cuốc Kim
//   Cương" = "Алмазная кирка").
// - "Lò Rèn" (кузница/горн) — естественный вьетнамский термин для места,
//   где улучшается кирка.
export const VI: Record<keyof typeof RU, string> = {
    'common.backToMenu': 'VỀ MENU CHÍNH',
    'common.max': 'MAX',
    'common.fallbackPlayerName': 'Người chơi',

    'menu.title': 'MÔ PHỎNG HẦM MỎ',
    'menu.play': 'CHƠI',
    'menu.upgrade': 'NÂNG CẤP',
    'menu.leaders': 'BẢNG XẾP HẠNG',
    'menu.stats.balance': 'XU: {value}',
    'menu.stats.maxDepth': 'KỶ LỤC ĐỘ SÂU: {value}',
    'menu.stats.totalMined': 'TỔNG ĐÃ ĐÀO: {value}',

    'upgrade.title': 'HẦM MỎ: NÂNG CẤP',
    'upgrade.balance': 'XU: {value}',
    'upgrade.rowTitle': '{name} (Cấp {level})',
    'upgrade.buy': 'Mua: {cost}',
    'upgrade.hp.name': 'Máu Cơ Bản (+5 Máu)',
    'upgrade.dmg.name': 'Sát Thương Cơ Bản (+1)',
    'upgrade.mult.name': 'Hệ Số Điểm (+7,5%)',
    'upgrade.ore.name': 'Tỷ Lệ Xuất Hiện Quặng (+5%)',
    'upgrade.forge.name': 'Tần Suất Lò Rèn (+8%)',

    'hud.depth': 'Độ sâu: {depth}  (Kỷ lục: {record})',
    'hud.score': 'Điểm: {value}',
    'hud.pickaxe': 'Cuốc {name} (Cấp {level})',
    'hud.damage': 'Sát Thương: {value}',
    'hud.multiplier': 'Hệ Số: x{value}',
    'hud.claimBalance': 'RÚT TIỀN',

    'gameover.text': 'CUỐC ĐÃ VỠ\nĐIỂM: {score}\n[KẾT THÚC]',
    'gameover.reviveAd': 'HỒI MÁU (XEM QUẢNG CÁO)',

    'milestone.text': 'KỶ LỤC MỚI: {depth}\n+{bonus} điểm, +{heal} độ bền',

    'pickaxe.wood': 'Gỗ',
    'pickaxe.stone': 'Đá',
    'pickaxe.iron': 'Sắt',
    'pickaxe.diamond': 'Kim Cương',

    'leaderboard.title': 'BẢNG XẾP HẠNG',
    'leaderboard.subtitle': 'theo kỷ lục độ sâu',
    'leaderboard.loading': 'Đang tải...',
    'leaderboard.unavailable': 'Bảng xếp hạng chỉ khả dụng\nkhi trò chơi đang chạy\ntrên Yandex Games',
    'leaderboard.fetchFailed': 'Không thể tải bảng xếp hạng.\nVui lòng thử lại sau.',
    'leaderboard.empty': 'Chưa ai chinh phục được hầm mỏ này.\nHãy là người đầu tiên!',
    'leaderboard.yourRank': 'HẠNG CỦA BẠN: {rank}',
    'leaderboard.podiumDepth': 'Độ sâu: {value}',
    'leaderboard.col.rank': 'HẠNG',
    'leaderboard.col.player': 'NGƯỜI CHƠI',
    'leaderboard.col.depth': 'ĐỘ SÂU',
    'leaderboard.col.coins': 'XU'
};
