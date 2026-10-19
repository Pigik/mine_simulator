import { RU } from './ru';

// Китайский (упрощённый). Пунктуация полноширинная (：（），).
export const ZH: Record<keyof typeof RU, string> = {
    'common.backToMenu': '返回菜单',
    'common.max': 'MAX',
    'common.fallbackPlayerName': '玩家',

    'menu.title': '矿井模拟器',
    'menu.play': '开始游戏',
    'menu.upgrade': '升级',
    'menu.leaders': '排行榜',
    'menu.stats.balance': '余额：{value}',
    'menu.stats.maxDepth': '深度记录：{value}',
    'menu.stats.totalMined': '累计挖矿：{value}',

    'upgrade.title': '矿井：升级',
    'upgrade.balance': '余额：{value}',
    'upgrade.rowTitle': '{name}（{level}级）',
    'upgrade.buy': '购买：{cost}',
    'upgrade.hp.name': '基础生命值（+5 生命值）',
    'upgrade.dmg.name': '基础伤害（+1）',
    'upgrade.mult.name': '得分倍率（+7.5%）',
    'upgrade.ore.name': '矿石生成率（+5%）',
    'upgrade.forge.name': '锻造台出现频率（+8%）',

    'hud.depth': '深度：{depth}（最佳：{record}）',
    'hud.score': '得分：{value}',
    'hud.pickaxe': '{name}镐（{level}级）',
    'hud.damage': '伤害：{value}',
    'hud.multiplier': '倍率：x{value}',
    'hud.claimBalance': '结算',

    'gameover.text': '镐子损坏了\n得分：{score}\n[结束本局]',
    'gameover.reviveAd': '恢复生命值（观看广告）',

    'milestone.text': '新纪录：{depth}\n+{bonus} 分，+{heal} 耐久度',

    'pickaxe.wood': '木',
    'pickaxe.stone': '石',
    'pickaxe.iron': '铁',
    'pickaxe.diamond': '钻石',

    'leaderboard.title': '排行榜',
    'leaderboard.subtitle': '按深度记录排名',
    'leaderboard.loading': '加载中...',
    'leaderboard.unavailable': '排行榜仅在游戏运行于\nYandex Games 平台时\n才可用',
    'leaderboard.fetchFailed': '无法加载排行榜。\n请稍后再试。',
    'leaderboard.empty': '还没有人征服过这座矿井。\n成为第一人吧！',
    'leaderboard.yourRank': '你的排名：{rank}',
    'leaderboard.podiumDepth': '深度：{value}',
    'leaderboard.col.rank': '排名',
    'leaderboard.col.player': '玩家',
    'leaderboard.col.depth': '深度',
    'leaderboard.col.coins': '金币'
};
