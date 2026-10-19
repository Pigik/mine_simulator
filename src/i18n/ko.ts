import { RU } from './ru';

// Корейский словарь.
//
// Заметки по локализации:
// - "Lv." для уровня — устоявшееся в корейских играх заимствование
//   (пишется слитно с числом: "Lv.5").
// - Кирка/материалы — термины, привычные корейским игрокам по жанру
//   майнинг-игр (곡괭이 = кирка; материал ставится ПЕРЕД словом "곡괭이":
//   "다이아몬드 곡괭이" = "Алмазная кирка").
// - "대장간" (кузница) — естественный корейский термин для места, где
//   улучшается кирка.
// - "강화" (усиление/прокачка) — более идиоматичный для корейских игр
//   термин для экрана апгрейдов, чем дословное заимствование "업그레이드".
// - "랭킹" — используется и для заголовка, и для кнопки таблицы лидеров
//   (единый термин по всему словарю).
export const KO: Record<keyof typeof RU, string> = {
    'common.backToMenu': '메인 메뉴로',
    'common.max': 'MAX',
    'common.fallbackPlayerName': '플레이어',

    'menu.title': '광산 시뮬레이터',
    'menu.play': '시작하기',
    'menu.upgrade': '강화',
    'menu.leaders': '랭킹',
    'menu.stats.balance': '잔액: {value}',
    'menu.stats.maxDepth': '최고 깊이: {value}',
    'menu.stats.totalMined': '누적 채굴량: {value}',

    'upgrade.title': '광산: 강화',
    'upgrade.balance': '잔액: {value}',
    'upgrade.rowTitle': '{name} (Lv.{level})',
    'upgrade.buy': '구매: {cost}',
    'upgrade.hp.name': '기본 체력 (+5 체력)',
    'upgrade.dmg.name': '기본 공격력 (+1)',
    'upgrade.mult.name': '점수 배율 (+7.5%)',
    'upgrade.ore.name': '광석 생성률 (+5%)',
    'upgrade.forge.name': '대장간 등장 빈도 (+8%)',

    'hud.depth': '깊이: {depth}  (최고: {record})',
    'hud.score': '점수: {value}',
    'hud.pickaxe': '{name} 곡괭이 (Lv.{level})',
    'hud.damage': '공격력: {value}',
    'hud.multiplier': '배율: x{value}',
    'hud.claimBalance': '정산하기',

    'gameover.text': '곡괭이가 부서졌습니다\n점수: {score}\n[게임 종료]',
    'gameover.reviveAd': '체력 회복 (광고 시청)',

    'milestone.text': '신기록: {depth}\n+{bonus} 점수, +{heal} 내구도',

    'pickaxe.wood': '나무',
    'pickaxe.stone': '돌',
    'pickaxe.iron': '철',
    'pickaxe.diamond': '다이아몬드',

    'leaderboard.title': '랭킹',
    'leaderboard.subtitle': '최고 깊이 기준',
    'leaderboard.loading': '로딩 중...',
    'leaderboard.unavailable': '랭킹은 게임이\nYandex Games에서 실행 중일 때만\n이용할 수 있습니다',
    'leaderboard.fetchFailed': '랭킹을 불러올 수 없습니다.\n나중에 다시 시도해 주세요.',
    'leaderboard.empty': '아직 아무도 광산을 정복하지 못했습니다.\n첫 번째가 되어보세요!',
    'leaderboard.yourRank': '내 순위: {rank}',
    'leaderboard.podiumDepth': '깊이: {value}',
    'leaderboard.col.rank': '순위',
    'leaderboard.col.player': '플레이어',
    'leaderboard.col.depth': '깊이',
    'leaderboard.col.coins': '코인'
};
