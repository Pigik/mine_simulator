import Phaser from 'phaser';
import { SaveSystem, type PlayerData } from '../yandex/CloudSave';
import { submitScore as submitLeaderboardScore } from '../yandex/Leaderboard';
import { createStoneButton } from '../ui/StoneButton';
import { createStonePanel } from '../ui/StonePanel';
import { createStatBar, type StatBarHandle } from '../ui/StatBar';
import { addCoinIcon } from '../ui/CoinIcon';
import { ACCENT, statTextStyle, secondaryTextStyle } from '../ui/theme';
import { createUtilityButtons } from '../ui/UtilityButtons';
import { setAdOverlayOpen } from '../audio/SoundPrefs';
import { t, type TranslationKey } from '../i18n';
import { setGameplayWantsActive } from '../yandex/GameplayApi';

// Глобальная конфигурация баланса и прокачки
export const GAME_CONFIG = {
    BASE_HP_START: 100,          // Начальное базовое HP
    HP_PER_UPGRADE: 10,          // Шаг прибавки HP за уровень (поменяйте на 3 для +3 HP)
    BASE_DMG_START: 10,         // Начальный базовый урон
    DMG_PER_UPGRADE: 1,         // Шаг прибавки урона за уровень
    SCORE_MULT_PER_UPGRADE: 0.075, // Прибавка к множителю очков (+7.5% за уровень; было +2.5%, увеличено в 3 раза)
    ORE_BONUS_PER_UPGRADE: 1,   // Коэффициент частоты спавна руд
    // Относительный прирост шанса встретить кузницу за уровень прокачки
    // (+8% к текущему шансу за уровень, максимум 15 уровней — см.
    // FORGE_MAX_LEVEL в MenuScene.ts) — эффект намеренно небольшой и с
    // потолком (см. Math.min(...) в generateRow), кузница остаётся редкой
    // приятной находкой, а не гарантированной частью каждого забега.
    FORGE_BONUS_PER_UPGRADE: 0.08,

    // "Вехи глубины" — награда за прохождение новой ЛИЧНОЙ рекордной глубины.
    // Стимулируют в каждом новом забеге копать дальше своего прошлого рекорда.
    DEPTH_MILESTONE_STEP: 20,       // Раз в сколько блоков глубины ЗА рекордом выдаётся награда
    MILESTONE_SCORE_BASE: 50,       // Базовый бонус очков за веху
    MILESTONE_SCORE_PER_DEPTH: 2,   // + очки за веху на каждый блок текущей глубины
    MILESTONE_HEAL_RATIO: 0.1,     // Какую долю макс. прочности кирки восстанавливает веха

    // Разгон темпа забега (см. updateGameSpeed() в GameScene): чем дольше
    // идёт текущий забег, тем быстрее течёт игровое время — просто чтобы не
    // приедалось долго копать в одном темпе. Работает через Phaser-овские
    // physics.world.timeScale/tweens.timeScale/time.timeScale (буквально
    // ускоряет время физики, анимаций и таймеров сцены), а НЕ через прямое
    // увеличение гравитации/скорости — так эффект на глаз выглядит именно
    // как "ускоренное время", а не как "стало тяжелее падать".
    // ВАЖНО: у этих трёх timeScale-параметров направление обратное интуиции —
    // значение БОЛЬШЕ 1 замедляет, МЕНЬШЕ 1 — ускоряет (см. updateGameSpeed()).
    // Именно из-за этого в первой версии фичи разгон получился перепутан
    // местами и вместо ускорения выходило замедление.
    // Это НЕ влияет на сложность (урон, HP, шансы руд остаются как есть) и
    // НЕ ускоряет звук/музыку — Sound Manager у Phaser не использует ни один
    // из этих timeScale и играет в обычном темпе всегда.
    SPEED_RAMP_PER_SECOND: 0.12, // на сколько растёт множитель скорости за каждую секунду забега; 0 — выключить разгон совсем
    SPEED_RAMP_MAX: 12           // потолок множителя скорости 
};

enum BlockType {
    DIRT, STONE, FORGE, BUFF_SIZE, DYNAMITE,
    ORE_COAL, ORE_GOLD, ORE_EMERALD, ORE_DIAMOND,
    ORE_IRON, ORE_RUBY
}

// ВАЖНО: здесь хранится КЛЮЧ локализации (nameKey), а не готовая строка —
// PICKAXE_LEVELS вычисляется один раз при загрузке модуля, ещё до того,
// как main.ts определит язык игрока (см. detectAndSetLocale в
// src/i18n/index.ts). Если бы здесь лежал уже переведённый текст, он
// навсегда "замёрз" бы на языке по умолчанию. Сам перевод — t(stat.nameKey)
// — происходит позже, в updateUI(), когда язык уже точно известен.
interface PickaxeStat { nameKey: TranslationKey; level: number; color: number; }

const PICKAXE_LEVELS: Record<number, PickaxeStat> = {
    1: { nameKey: 'pickaxe.wood', level: 1, color: 0x8B4513 },
    2: { nameKey: 'pickaxe.stone', level: 2, color: 0xC0C0C0 },
    3: { nameKey: 'pickaxe.iron', level: 3, color: 0xC0C0C0 },
    4: { nameKey: 'pickaxe.diamond', level: 4, color: 0x00FFFF }
};

interface BlockDef { hp: number; score: number; texture: string; isOre: boolean; veinMin: number; veinMax: number; }

const BLOCKS: Record<number, BlockDef> = {
    [BlockType.DIRT]: { hp: 5, score: 0, texture: 'grass', isOre: false, veinMin: 0, veinMax: 0 },
    [BlockType.STONE]: { hp: 10, score: 0, texture: 'rough_stone', isOre: false, veinMin: 0, veinMax: 0 },
    [BlockType.FORGE]: { hp: 5, score: 0, texture: 'forge', isOre: false, veinMin: 0, veinMax: 0 },
    [BlockType.BUFF_SIZE]: { hp: 5, score: 0, texture: 'buff_size', isOre: false, veinMin: 0, veinMax: 0 },
    [BlockType.DYNAMITE]: { hp: 5, score: 0, texture: 'dynamite', isOre: false, veinMin: 0, veinMax: 0 },
    // Экономика руд — единая геометрическая прогрессия на 6 уровней редкости
    // (уголь -> железо -> золото -> рубин -> алмаз -> изумруд): HP руды
    // растёт x1.5 за уровень, очки — x2.35 за уровень, поэтому "эффективность"
    // (очки за 1 HP прочности блока) растёт ровно в ~1.57 раза на каждом
    // уровне — гладкая кривая без провалов: чем глубже, тем ощутимо выгоднее
    // копать, без резких скачков ценности между соседними рудами.
    [BlockType.ORE_COAL]: { hp: 15, score: 20, texture: 'coal_ore', isOre: true, veinMin: 3, veinMax: 6 },
    [BlockType.ORE_IRON]: { hp: 22, score: 47, texture: 'iron_ore', isOre: true, veinMin: 3, veinMax: 7 },
    [BlockType.ORE_GOLD]: { hp: 34, score: 110, texture: 'gold_ore', isOre: true, veinMin: 3, veinMax: 5 },
    [BlockType.ORE_RUBY]: { hp: 51, score: 260, texture: 'ruby_ore', isOre: true, veinMin: 2, veinMax: 4 },
    [BlockType.ORE_DIAMOND]: { hp: 100, score: 710, texture: 'diamond_ore', isOre: true, veinMin: 1, veinMax: 2 },
    [BlockType.ORE_EMERALD]: { hp: 144, score: 1634, texture: 'emerald_ore', isOre: true, veinMin: 1, veinMax: 2 }
};

interface BlockData {
    type: BlockType;
    hp: number;
    maxHp: number;
    score: number;
    sprite: Phaser.Physics.Arcade.Sprite;
    crackSprite: Phaser.GameObjects.Sprite;
    x: number; y: number;
}

interface VeinState { type: BlockType; remaining: number; }

export class GameScene extends Phaser.Scene {
    private grid: (BlockData | null)[][] = [];
    private cols = 12;
    private blockSize = 96;
    private offsetX = 200;

    private currentPickaxeLevel = 1;
    private maxPickaxeHp = 50;
    private pickaxeHp = 50;
    private score = 0;
    private currentRowIdx = 0;
    private currentDepth = 0;

    private pData!: PlayerData;
    private scoreMultiplier = 1.0;
    private oreBonus = 0;
    // Внутреннее имя поля сохранения (pData.lvlBench) не переименовано вместе
    // с апгрейдом — это persisted-поле (см. PlayerData в yandex/CloudSave.ts),
    // и переименование молча обнулило бы уровень кузницы у тех, кто уже
    // играл. forgeBonus здесь читает именно его.
    private forgeBonus = 0;
    // Момент начала текущего забега (this.time.now) — от него отсчитывается
    // разгон темпа, см. updateGameSpeed()/GAME_CONFIG.SPEED_RAMP_*.
    private runStartTime = 0;

    // HUD во время игры — каменная панель вместо чёрного текстового блока
    // (см. buildHud()/updateUI()): крупно глубина/прочность/счёт,
    // второстепенное (тип кирки, урон, множитель) — отдельными строками
    // в столбик внизу панели, от более важного к менее важному.
    private hudDepthText!: Phaser.GameObjects.Text;
    private hudDurabilityBar!: StatBarHandle;
    private hudDurabilityLabel!: Phaser.GameObjects.Text;
    private hudScoreText!: Phaser.GameObjects.Text;
    private hudPickaxeText!: Phaser.GameObjects.Text;
    private hudDamageText!: Phaser.GameObjects.Text;
    private hudMultiplierText!: Phaser.GameObjects.Text;
    private pickaxe!: Phaser.Physics.Arcade.Sprite;
    // [ОТЛАДКА] Зелёная рамка вокруг текущего хитбокса кирки — включена этим
    // флагом. Отладка коллизии закончена — выключено (false).
    private readonly DEBUG_SHOW_PICKAXE_HITBOX = false;
    private pickaxeHitboxDebug!: Phaser.GameObjects.Graphics;
    // Размер хитбокса кирки БЕЗ поворота (angle = 0), в тех же условных
    // единицах, что и старый pickaxe.setSize(50, 65). Именно эти два числа
    // нужно будет подправить, когда сменится текстура кирки — включите
    // physics.arcade.debug в конфиге игры, чтобы увидеть хитбокс поверх
    // спрайта и подобрать значения по новой картинке.
    private readonly pickaxeBaseWidth = 35;
    private readonly pickaxeBaseHeight = 50;

    // --- Настройки отскока кирки от блоков (по горизонтали) ---
    // Сколько текущей горизонтальной скорости кирка сохраняет при каждом
    // ударе (инерция) — чем выше, тем меньше её "сдувает" в сторону одним
    // ударом.
    private readonly BOUNCE_MOMENTUM_KEEP = 0.62;
    // Базовый толчок в сторону от удара, не зависящий от точного пикселя
    // попадания — чтобы похожие по смыслу удары не давали случайно очень
    // разные по силе отскоки.
    private readonly BOUNCE_BASE_IMPULSE = 70;
    // Дополнительный толчок, растущий с тем, насколько "не в центр" блока
    // пришёлся удар.
    private readonly BOUNCE_OFFSET_IMPULSE = 1.6;
    // Случайный разброс силы толчка — источник аркадной непредсказуемости,
    // из-за которого маршрут падения каждый раз получается новым даже при
    // похожих ударах.
    private readonly BOUNCE_RANDOM_JITTER = 28;
    // Максимальное изменение горизонтальной скорости ЗА ОДИН удар. Именно
    // этот предел не даёт кирке, летящей быстро в одну сторону, мгновенно
    // развернуться в другую — скорость может только постепенно "стечь" к
    // нулю и затем набраться в противоположном направлении за несколько
    // ударов подряд, а не рывком.
    private readonly BOUNCE_MAX_VX_DELTA = 140;
    private readonly BOUNCE_MAX_VX = 300;
    // Ниже этой вертикальной скорости гасим "дребезг" от мелких отскоков на
    // стыках блоков, иначе кирка может мелко подрагивать вверх-вниз.
    private readonly BOUNCE_MIN_VY = 40;

    // --- Обычные (не ускоренные) физические параметры кирки ---
    // Разгон темпа (см. updateGameSpeed) их больше не трогает — он ускоряет
    // само игровое время через timeScale, а не эти числа. GRAVITY_Y должно
    // совпадать со значением gravity.y в src/main.ts.
    private readonly BASE_GRAVITY_Y = 520;
    private readonly BASE_MAX_VX = 350;
    private readonly BASE_MAX_VY = 1200;

    // --- Настройки вращения кирки ---
    private readonly SPIN_FROM_VX = 1.8;
    private readonly SPIN_MAX = 480;
    private readonly SPIN_RANDOM_JITTER = 35;
    // Насколько быстро вращение "доезжает" до новой цели за один удар (0..1)
    // — чтобы спин не дёргался рывком при каждой смене скорости.
    private readonly SPIN_SMOOTHING = 0.5;

    // --- Отдача от взрыва динамита (см. applyExplosionKnockback) ---
    // Это отдельный, более сильный толчок поверх обычного лёгкого отскока от
    // удара (BOUNCE_*) — срабатывает только при прямом подрыве динамита киркой.
    // Значение подобрано на глаз, можно менять: больше — сильнее отбрасывает.
    private readonly DYNAMITE_KNOCKBACK_FORCE = 260;
    // Гарантированная добавка вверх, чтобы взрыв ощутимо подбрасывал кирку,
    // даже если она была точно сбоку или снизу от динамита (когда вертикальная
    // составляющая направления "от взрыва" близка к нулю).
    private readonly DYNAMITE_KNOCKBACK_UPWARD_BONUS = 80;

    private blocksGroup!: Phaser.Physics.Arcade.StaticGroup;
    private sizeBuffEvent: Phaser.Time.TimerEvent | null = null;

    private columnVeins: (VeinState | null)[] = [];
    // Монолит по краям каждой сгенерированной строки — хранится отдельно от
    // this.grid (там только добываемые блоки поля), чтобы страховка от
    // "провала сквозь блок" (см. resolveMonolithOverlap) могла проверять и
    // его тоже: индекс строки здесь всегда совпадает с индексом в this.grid.
    private monolithRows: { left: Phaser.Physics.Arcade.Sprite; right: Phaser.Physics.Arcade.Sprite }[] = [];
    // Блоки, по которым удар уже засчитан обычным Arcade-коллайдером в этом кадре
    // (нужно, чтобы страховочная проверка ниже не била по ним повторно).
    private hitBlocksThisFrame: Set<BlockData> = new Set();
    // Следующая глубина (в блоках), за прохождение которой будет выдана
    // награда "новый рекорд" — считается от pData.maxDepth при старте забега.
    private nextMilestoneDepth = 0;

    constructor() { super('GameScene'); }

    // Расчет Max HP: (Базовое HP) * Уровень кирки
    private calculateMaxHp(level: number): number {
        const baseHp = GAME_CONFIG.BASE_HP_START + (this.pData.lvlHp * GAME_CONFIG.HP_PER_UPGRADE);
        return baseHp * level;
    }

    // Расчет Урона: (Базовый урон) * Уровень кирки
    private calculateDamage(level: number): number {
        const baseDamage = GAME_CONFIG.BASE_DMG_START + (this.pData.lvlDamage * GAME_CONFIG.DMG_PER_UPGRADE);
        return baseDamage * level;
    }

    // Плавно "открывает" руду начиная с unlockDepth: до этой глубины шанс = 0
    // (руда физически не может выпасть раньше — фиксит джекпоты типа изумруда
    // на первых секундах забега), дальше шанс растёт от minChance до maxChance
    // на протяжении rampBlocks блоков и затем держится на максимуме. Всё в
    // промилле (0.1%). Прокачка "частота спавна руд" домножает результат
    // снаружи (см. oreBoostMult в generateRow) одним и тем же множителем для
    // всех руд, поэтому она никогда не может нарушить их порядок редкости.
    private getGatedOreChance(depth: number, unlockDepth: number, rampBlocks: number, minChance: number, maxChance: number): number {
        if (depth < unlockDepth) return 0;
        let progress = Math.min(1, (depth - unlockDepth) / rampBlocks);
        return minChance + (maxChance - minChance) * progress;
    }

    init(data: PlayerData) {
        this.pData = data || { balance: 0, lvlHp: 0, lvlMult: 0, lvlOre: 0, lvlDamage: 0, lvlBench: 0, maxDepth: 0, totalCoinsMined: 0 };

        this.currentPickaxeLevel = 1;
        this.maxPickaxeHp = this.calculateMaxHp(this.currentPickaxeLevel);
        this.pickaxeHp = this.maxPickaxeHp;

        this.scoreMultiplier = 1.0 + (this.pData.lvlMult * GAME_CONFIG.SCORE_MULT_PER_UPGRADE);
        this.oreBonus = this.pData.lvlOre * GAME_CONFIG.ORE_BONUS_PER_UPGRADE;
        this.forgeBonus = (this.pData.lvlBench || 0) * GAME_CONFIG.FORGE_BONUS_PER_UPGRADE;

        this.score = 0;
        this.currentDepth = 0;
        this.nextMilestoneDepth = (Math.floor(this.pData.maxDepth / GAME_CONFIG.DEPTH_MILESTONE_STEP) + 1) * GAME_CONFIG.DEPTH_MILESTONE_STEP;
        this.grid = [];
        this.monolithRows = [];
        this.currentRowIdx = 0;
        this.sizeBuffEvent = null;
        this.columnVeins = Array(this.cols).fill(null);
    }

    preload() {
        const textures = ['grass', 'dirt', 'rough_stone', 'forge', 'buff_size', 'dynamite', 'coal_ore', 'iron_ore', 'gold_ore', 'ruby_ore', 'emerald_ore', 'diamond_ore'];
        textures.forEach(key => this.load.image(key, `assets/${key}.png`));

        for (let i = 1; i <= 4; i++) this.load.image(`pickaxe_${i}`, `assets/pickaxe_${i}.png`);
        for (let i = 1; i <= 3; i++) this.load.image(`crack_${i}`, `assets/crack_${i}.png`);

        this.load.image('bg_mine', 'assets/bg_mine.png');
        this.load.image('monolith', 'assets/monolith.png');

        this.load.audio('bgm_mine', 'assets/audio/bgm_mine.mp3');
        this.load.audio('sfx_hit', 'assets/audio/sfx_hit.mp3');
        this.load.audio('sfx_break', 'assets/audio/sfx_break.mp3');
        this.load.audio('sfx_dirt', 'assets/audio/sfx_dirt.mp3'); // Звук разрушения земли
        this.load.audio('sfx_destroy', 'assets/audio/sfx_destroy.mp3');
        this.load.audio('click-menu', 'assets/audio/click-menu.mp3');
        this.load.audio('bang', 'assets/audio/bang.mp3'); // Звук взрыва динамита
    }

    create() {
        // Требование Яндекс Игр (см. GameplayApi.ts): забег начался —
        // геймплей активен. Сбрасывается в false при экране поражения
        // (checkGameOver) и при выходе в меню (claimBalanceAndExit).
        setGameplayWantsActive(true);

        this.createFallbackTextures();

        // Разгон темпа отсчитывается от начала ЭТОГО забега — на рестарт
        // сцены (новая игра) сбрасывается вместе со всем остальным, и все
        // timeScale-часы (физика/твины/таймеры) на всякий случай возвращаем
        // к обычному темпу x1, а гравитацию — к базовой (она сама больше не
        // меняется, см. updateGameSpeed).
        //
        // ВАЖНО: раньше здесь стояло this.time.now — и это был реальный баг.
        // this.time (Clock сцены) обновляется только пока СЦЕНА активна: она
        // подписывается на событие update и лишь тогда обновляет .now. Пока
        // GameScene остановлена (игрок в главном меню/прокачке/лидерах),
        // .now просто ЗАМОРОЖЕН на моменте окончания предыдущего забега — и
        // в первый же миг create() (до того, как сцена реально начнёт
        // получать update-тики заново) читает именно это старое замороженное
        // значение. В следующем кадре .now скачком становится настоящим
        // текущим временем, а разница (this.time.now - runStartTime) в
        // updateGameSpeed() выходит равна ВСЕМУ реальному времени, которое
        // прошло, пока игрок сидел в меню — отсюда и "кирка сразу разогнана
        // с самого старта, и тем сильнее, чем дольше проторчал в меню".
        // this.game.loop.time — это глобальные часы игры, они тикают
        // непрерывно независимо от того, какая сцена сейчас активна, поэтому
        // всегда дают свежее текущее время прямо здесь, без задержки на кадр.
        this.runStartTime = this.game.loop.time;
        this.physics.world.gravity.y = this.BASE_GRAVITY_Y;
        this.physics.world.timeScale = 1;
        this.tweens.timeScale = 1;
        this.time.timeScale = 1;

        let bgTexture = this.textures.exists('bg_mine') ? 'bg_mine' : 'fallback_bg';
        this.add.tileSprite(800, 450, 1600, 900, bgTexture)
            .setScrollFactor(0)
            .setDepth(-100);

        this.blocksGroup = this.physics.add.staticGroup();

        let pickaxeTex = this.textures.exists(`pickaxe_${this.currentPickaxeLevel}`)
            ? `pickaxe_${this.currentPickaxeLevel}`
            : 'fallback_pickaxe';

        this.pickaxe = this.physics.add.sprite(this.offsetX + 300, 50, pickaxeTex);
        this.pickaxe.setScale(2);
        this.pickaxe.setSize(this.pickaxeBaseWidth, this.pickaxeBaseHeight);
        this.pickaxe.setDepth(50);

        this.pickaxe.setBounce(0.5, 0.4);
        this.pickaxe.setCollideWorldBounds(true);
        this.pickaxe.setMaxVelocity(this.BASE_MAX_VX, this.BASE_MAX_VY);
        this.pickaxe.setDragX(90);
        this.pickaxe.setAngularVelocity(220);

        this.physics.world.setBounds(0, 0, 1600, Number.MAX_SAFE_INTEGER);
        this.physics.add.collider(this.pickaxe, this.blocksGroup, this.onHitBlock as any, undefined, this);

        if (this.DEBUG_SHOW_PICKAXE_HITBOX) {
            // Рисуется поверх всего и в мировых координатах, поэтому скроллится
            // вместе со сценой как положено.
            this.pickaxeHitboxDebug = this.add.graphics().setDepth(999);
        }

        this.buildHud();

        this.updateUI();

        for (let i = 0; i < 15; i++) {
            this.generateRow();
        }

        this.sound.stopAll();
        this.safePlaySound('bgm_mine', { loop: true, volume: 0.15 });
    }

    update() {
        this.updateGameSpeed();

        if (this.DEBUG_SHOW_PICKAXE_HITBOX) this.drawPickaxeHitboxDebug();

        if (this.pickaxeHp <= 0) return;

        let targetY = this.pickaxe.y - 300;
        if (targetY > this.cameras.main.scrollY) {
            this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetY, 0.1);
        }

        if (this.pickaxe.y > this.currentRowIdx * this.blockSize - 1000) {
            this.generateRow();
        }

        this.updatePickaxeHitbox();
        this.resolveMissedBlockOverlaps();
        this.hitBlocksThisFrame.clear();
    }

    // Плавно поднимает темп забега со временем — см. GAME_CONFIG.SPEED_RAMP_*
    // в начале файла для настройки. Работает через Phaser-овские
    // physics.world.timeScale/tweens.timeScale/time.timeScale — то есть
    // буквально ускоряет игровое время (физику, твины/анимации блоков и
    // таймеры сцены), а не какие-то отдельные числа вроде гравитации.
    // this.time.now при этом НЕ зависит от timeScale (это всегда настоящее,
    // невзвешенное время), так что elapsedSeconds ниже растёт ровно с
    // реальной скоростью — без обратной связи и разгона самого разгона.
    //
    // ВАЖНО (и не очевидно): эти три timeScale-параметра работают
    // ПО-РАЗНОМУ друг с другом:
    //  - physics.world.timeScale — направление ОБРАТНОЕ тому, что кажется
    //    логичным: 1.0 = обычная скорость, 2.0 = вдвое МЕДЛЕННЕЕ, 0.5 =
    //    вдвое БЫСТРЕЕ (задокументированная особенность именно Arcade
    //    Physics World, не баг в нашем коде) — поэтому сюда идёт величина,
    //    ОБРАТНАЯ множителю разгона (1 / speedMultiplier).
    //  - tweens.timeScale и time.timeScale (таймеры сцены) — ведут себя как
    //    обычно ожидалось бы: 2.0 ускоряет вдвое, 0.5 замедляет вдвое —
    //    поэтому сюда идёт сам speedMultiplier БЕЗ инверсии.
    //  (Именно из-за того, что раньше сюда по ошибке шла та же обратная
    //  величина для всех трёх параметров, анимация исчезновения блока и
    //  другие твины на самом деле замедлялись вместо ускорения — исправлено.)
    //
    // Звук и музыку это не трогает вообще: Phaser Sound Manager не подписан
    // ни на один из этих timeScale и всегда играет в обычном темпе.
    private updateGameSpeed() {
        if (GAME_CONFIG.SPEED_RAMP_PER_SECOND <= 0) return;

        const elapsedSeconds = (this.time.now - this.runStartTime) / 1000;
        const speedMultiplier = Math.min(
            GAME_CONFIG.SPEED_RAMP_MAX,
            1 + elapsedSeconds * GAME_CONFIG.SPEED_RAMP_PER_SECOND
        );

        this.physics.world.timeScale = 1 / speedMultiplier; // падение, отскоки, столкновения (у Arcade World направление обратное!)
        this.tweens.timeScale = speedMultiplier;             // анимации (исчезновение блока, сжатие при ударе, баф размера и т.п.)
        this.time.timeScale = speedMultiplier;               // таймеры сцены (например, длительность бафа размера)
    }

    private generateRow() {
        let row: (BlockData | null)[] = [];
        let y = this.currentRowIdx;
        let leftVein: VeinState | null = null;
        let posY = y * this.blockSize + this.blockSize / 2 + 150;

        let monolithTex = this.textures.exists('monolith') ? 'monolith' : 'fallback_block';

        let monolithL = this.blocksGroup.create(this.offsetX - this.blockSize / 2, posY, monolithTex) as Phaser.Physics.Arcade.Sprite;
        monolithL.setDisplaySize(this.blockSize, this.blockSize).setDepth(10).refreshBody();

        let monolithR = this.blocksGroup.create(this.offsetX + this.cols * this.blockSize + this.blockSize / 2, posY, monolithTex) as Phaser.Physics.Arcade.Sprite;
        monolithR.setDisplaySize(this.blockSize, this.blockSize).setDepth(10).refreshBody();

        this.monolithRows.push({ left: monolithL, right: monolithR });

        for (let x = 0; x < this.cols; x++) {
            let type = BlockType.STONE;
            let topVein = this.columnVeins[x];
            let isPlacedFromVein = false;
            let rand = Phaser.Math.Between(0, 100);

            let clusterChance = 35 + Math.min(40, this.pData.lvlOre * 3);

            if (leftVein && leftVein.remaining > 0 && rand < clusterChance) {
                type = leftVein.type;
                leftVein.remaining--;
                isPlacedFromVein = true;
            } else if (topVein && topVein.remaining > 0 && rand < clusterChance) {
                type = topVein.type;
                topVein.remaining--;
                isPlacedFromVein = true;
            }

            if (!isPlacedFromVein) {
                if (y < 3) {
                    type = BlockType.DIRT;
                } else if (y < 6) {
                    type = (rand < 85) ? BlockType.DIRT : BlockType.STONE;
                } else {
                    // Шанс каждой руды в промилле (0.1%), жёстко заблокирован до
                    // своей глубины разблокировки и плавно растёт после неё —
                    // редкие руды физически не могут выпасть в начале забега.
                    let r2 = Phaser.Math.Between(0, 999);

                    // Один и тот же множитель для всех руд: прокачка "частота
                    // спавна руд" делает их все пропорционально чаще, но никогда не
                    // меняет порядок редкости (уголь > золото > алмаз > изумруд).
                    // 6 уровней редкости, от самой частой до самой редкой руды.
                    // unlock растёт с увеличивающимся шагом (6→12→20→30→42→58),
                    // а maxChance убывает примерно на 35-45% за уровень — вместе
                    // это даёт ощущение "новой главы" при каждой разблокировке,
                    // без резких обрывов частоты.
                    let oreBoostMult = 1 + this.oreBonus * 0.05;
                    let chanceCoal = this.getGatedOreChance(y, 6, 18, 45, 110) * oreBoostMult;
                    let chanceIron = this.getGatedOreChance(y, 12, 20, 25, 70) * oreBoostMult;
                    let chanceGold = this.getGatedOreChance(y, 20, 24, 15, 45) * oreBoostMult;
                    let chanceRuby = this.getGatedOreChance(y, 30, 26, 9, 28) * oreBoostMult;
                    let chanceDiamond = this.getGatedOreChance(y, 42, 28, 5, 16) * oreBoostMult;
                    let chanceEmerald = this.getGatedOreChance(y, 58, 32, 3, 9) * oreBoostMult;

                    // На больших уровнях прокачки сумма шансов может выйти за пределы
                    // шкалы — масштабируем руды пропорционально (порядок редкости не
                    // меняется), чтобы обычный камень никогда не исчезал совсем
                    // (минимум ~10%).
                    let oreTotal = chanceCoal + chanceIron + chanceGold + chanceRuby + chanceDiamond + chanceEmerald;
                    const ORE_CHANCE_CAP = 900;
                    if (oreTotal > ORE_CHANCE_CAP) {
                        let scale = ORE_CHANCE_CAP / oreTotal;
                        chanceCoal *= scale;
                        chanceIron *= scale;
                        chanceGold *= scale;
                        chanceRuby *= scale;
                        chanceDiamond *= scale;
                        chanceEmerald *= scale;
                    }

                    let cEmerald = chanceEmerald;
                    let cDiamond = cEmerald + chanceDiamond;
                    let cRuby = cDiamond + chanceRuby;
                    let cGold = cRuby + chanceGold;
                    let cIron = cGold + chanceIron;
                    let cCoal = cIron + chanceCoal;
                    let cDynamite = cCoal + 30;
                    let cBuff = cDynamite + 30;
                    // Прокачка "частота кузниц" даёт +FORGE_BONUS_PER_UPGRADE
                    // (по умолчанию +8%) к базовому шансу за уровень, максимум
                    // 15 уровней (см. FORGE_MAX_LEVEL в MenuScene.ts) — то есть
                    // не больше x2.2 от базового (10 -> 22 из 1000). Дополнительный
                    // потолок в 40 — просто защита от будущих изменений баланса,
                    // при текущих цифрах не срабатывает.
                    let cForge = cBuff + Math.min(40, 10 * (1 + this.forgeBonus));

                    if (r2 < cEmerald) type = BlockType.ORE_EMERALD;
                    else if (r2 < cDiamond) type = BlockType.ORE_DIAMOND;
                    else if (r2 < cRuby) type = BlockType.ORE_RUBY;
                    else if (r2 < cGold) type = BlockType.ORE_GOLD;
                    else if (r2 < cIron) type = BlockType.ORE_IRON;
                    else if (r2 < cCoal) type = BlockType.ORE_COAL;
                    else if (r2 < cDynamite) type = BlockType.DYNAMITE;
                    else if (r2 < cBuff) type = BlockType.BUFF_SIZE;
                    else if (r2 < cForge) type = BlockType.FORGE;
                    else type = BlockType.STONE;
                }

                if (BLOCKS[type].isOre) {
                    let vSize = Phaser.Math.Between(BLOCKS[type].veinMin, BLOCKS[type].veinMax);
                    leftVein = { type: type, remaining: vSize - 1 };
                    this.columnVeins[x] = { type: type, remaining: vSize - 1 };
                } else {
                    leftVein = null;
                    this.columnVeins[x] = null;
                }
            } else {
                this.columnVeins[x] = (leftVein && leftVein.remaining > 0) ? leftVein : topVein;
            }

            let def = BLOCKS[type];
            let posX = this.offsetX + x * this.blockSize + this.blockSize / 2;
            // Трава — только на самом верхнем слое (y === 0). Ниже BlockType.DIRT
            // визуально отображается уже как обычный грунт (текстура dirt),
            // хотя по игровой логике это всё тот же тип блока.
            let desiredTexture = (type === BlockType.DIRT && y > 0) ? 'dirt' : def.texture;
            let texKey = this.textures.exists(desiredTexture) ? desiredTexture : 'fallback_block';

            let sprite = this.blocksGroup.create(posX, posY, texKey) as Phaser.Physics.Arcade.Sprite;
            sprite.setDisplaySize(this.blockSize - 2, this.blockSize - 2).setDepth(10).refreshBody();

            let crackTex = this.textures.exists('crack_1') ? 'crack_1' : 'fallback_block';
            let crackSprite = this.add.sprite(posX, posY, crackTex)
                .setDisplaySize(this.blockSize - 2, this.blockSize - 2)
                .setAlpha(0)
                .setDepth(20);

            // Было +2% прочности блока за уровень глубины — чуть увеличили
            // до +2.5%, чтобы глубокие забеги ощутимее упирались в прочность
            // блоков (без резкого скачка сложности).
            let depthMultiplier = 1.0 + (y * 0.025);
            let actualHp = Math.floor(def.hp * depthMultiplier);

            let blockData: BlockData = {
                type, hp: actualHp, maxHp: actualHp, score: def.score, sprite, crackSprite, x, y
            };

            row.push(blockData);
            sprite.setData('blockRef', blockData);
        }

        this.grid.push(row);
        this.currentRowIdx++;
    }

    private onHitBlock(_pickaxeObj: Phaser.GameObjects.GameObject, blockObj: Phaser.GameObjects.GameObject) {
        if (this.pickaxeHp <= 0) return;

        let spriteObj = blockObj as Phaser.Physics.Arcade.Sprite;
        let diffX = this.pickaxe.x - spriteObj.x;
        let physicsBody = this.pickaxe.body as Phaser.Physics.Arcade.Body;
        let vx = physicsBody.velocity.x;

        // Направление толчка — в какую сторону от блока должно оттолкнуть
        // кирку, плюс случайная составляющая (тот самый аркадный элемент,
        // из-за которого маршрут падения каждый раз новый).
        let hitSign = diffX === 0 ? (Phaser.Math.Between(0, 1) ? 1 : -1) : Math.sign(diffX);
        let impulseX = hitSign * this.BOUNCE_BASE_IMPULSE
            + diffX * this.BOUNCE_OFFSET_IMPULSE
            + Phaser.Math.FloatBetween(-this.BOUNCE_RANDOM_JITTER, this.BOUNCE_RANDOM_JITTER);

        let desiredVx = vx * this.BOUNCE_MOMENTUM_KEEP + impulseX;

        // Ограничиваем изменение скорости за один удар — это и не даёт кирке,
        // летящей быстро в одну сторону, мгновенно развернуться в другую:
        // скорость может только постепенно затормозиться и затем набраться
        // в противоположном направлении за несколько ударов, а не рывком.
        let newVx = Phaser.Math.Clamp(desiredVx, vx - this.BOUNCE_MAX_VX_DELTA, vx + this.BOUNCE_MAX_VX_DELTA);
        newVx = Phaser.Math.Clamp(newVx, -this.BOUNCE_MAX_VX, this.BOUNCE_MAX_VX);

        this.pickaxe.setVelocityX(newVx);

        // Вращение плавно "доезжает" до новой цели, а не дёргается рывком
        // вслед за каждым изменением скорости — так смена направления
        // выглядит аккуратно, а не режет глаз.
        let targetSpin = Phaser.Math.Clamp(newVx * this.SPIN_FROM_VX, -this.SPIN_MAX, this.SPIN_MAX)
            + Phaser.Math.FloatBetween(-this.SPIN_RANDOM_JITTER, this.SPIN_RANDOM_JITTER);
        this.pickaxe.setAngularVelocity(
            Phaser.Math.Linear(physicsBody.angularVelocity, targetSpin, this.SPIN_SMOOTHING)
        );

        // Гасим мелкий вертикальный "дребезг" на стыках блоков — иначе кирка
        // может мелко подрагивать вверх-вниз, что выглядит как баг, а не как
        // красивый отскок.
        if (physicsBody.touching.up && Math.abs(physicsBody.velocity.y) < this.BOUNCE_MIN_VY) {
            this.pickaxe.setVelocityY(0);
        }

        let blockData = spriteObj.getData('blockRef') as BlockData;
        if (!blockData) {
            // Неразрушимый объект (например, монолит) — звука разрушения для
            // него не будет, поэтому звук удара нужен всегда.
            this.playHitSound();
            return;
        }

        this.hitBlocksThisFrame.add(blockData);

        // Вычисление динамического урона
        let totalDamage = this.calculateDamage(this.currentPickaxeLevel);
        blockData.hp -= totalDamage;

        // Было +1 к урону по кирке за каждые 20 блоков глубины — снизили
        // темп роста (шаг раз в 25 блоков вместо 20), чтобы урон с глубиной
        // рос чуть медленнее, оставаясь ощутимым.
        let depthPenalty = Math.floor(blockData.y / 25);
        // HP кирки не должно уходить в минус — иначе в HUD и на экране
        // гейм-овера мелькает отрицательное число вместо честного нуля.
        this.pickaxeHp = Math.max(0, this.pickaxeHp - (1 + depthPenalty));

        this.tweens.add({ targets: [blockData.sprite, blockData.crackSprite], scale: 0.85, yoyo: true, duration: 60 });

        if (blockData.hp <= 0) {
            // Блок ломается этим же ударом — звук удара не проигрываем,
            // будет только звук разрушения (см. destroyBlock).
            this.destroyBlock(blockData.x, blockData.y, false);
        } else {
            // Блок выдержал удар — проигрываем обычный звук удара.
            this.playHitSound();

            let ratio = blockData.hp / blockData.maxHp;
            if (this.textures.exists('crack_3') && ratio <= 0.33) blockData.crackSprite.setTexture('crack_3').setAlpha(1);
            else if (this.textures.exists('crack_2') && ratio <= 0.66) blockData.crackSprite.setTexture('crack_2').setAlpha(1);
            else if (this.textures.exists('crack_1') && ratio < 1.0) blockData.crackSprite.setTexture('crack_1').setAlpha(1);
        }

        this.updateUI();
        this.checkGameOver();
    }

    // Страховка от "провала" кирки сквозь блок.
    // Arcade Physics определяет столкновение по взаимному ДВИЖЕНИЮ тел за кадр:
    // если хитбокс кирки резко увеличивается (бонус BUFF_SIZE) и мгновенно
    // перекрывает соседний блок, а относительная скорость по нужной оси в этот
    // момент нулевая, физика помечает тела как "вложенные" (embedded) и НЕ
    // расталкивает их и не вызывает столкновение как обычное касание — из-за
    // этого кирка может провалиться сквозь блок, стоящий рядом.
    // Здесь мы независимо проверяем реальное пересечение прямоугольников кирки
    // и соседних блоков и для любого блока, который обычный коллайдер не
    // засчитал в этом кадре, вручную наносим удар и выталкиваем кирку наружу.
    // Arcade Physics не умеет поворачивать хитбокс вместе со спрайтом — тело
    // всегда остаётся осевым прямоугольником (AABB). Раньше это давало
    // фиксированный вертикальный прямоугольник 50x65, который совпадал с
    // картинкой только когда кирка стояла "как в покое", а при повороте
    // (особенно горизонтально, около 90°/270°) сильно расходился с видимыми
    // краями спрайта.
    //
    // Здесь мы на каждом кадре пересчитываем ширину/высоту тела так, как если
    // бы прямоугольник pickaxeBaseWidth x pickaxeBaseHeight был жёстко привязан
    // к спрайту и повёрнут на его текущий угол — берём габаритный прямоугольник
    // (AABB) этого повёрнутого прямоугольника. При повороте на 90° ширина и
    // высота меняются местами, и хитбокс снова точно облегает картинку в её
    // горизонтальном положении, а не остаётся "вертикальным".
    // [ОТЛАДКА] Рисует рамку вокруг текущего хитбокса (AABB) кирки —
    // включается флагом DEBUG_SHOW_PICKAXE_HITBOX выше. Полезно, чтобы глазами
    // сверить, насколько рамка совпадает с картинкой кирки при повороте.
    private drawPickaxeHitboxDebug() {
        const body = this.pickaxe.body as Phaser.Physics.Arcade.Body;
        if (!body || !this.pickaxeHitboxDebug) return;

        this.pickaxeHitboxDebug.clear();
        this.pickaxeHitboxDebug.lineStyle(2, 0x00ff00, 1);
        this.pickaxeHitboxDebug.strokeRect(body.x, body.y, body.width, body.height);
    }

    private updatePickaxeHitbox() {
        const body = this.pickaxe.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        const rad = this.pickaxe.rotation;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));

        const width = this.pickaxeBaseWidth * cos + this.pickaxeBaseHeight * sin;
        const height = this.pickaxeBaseWidth * sin + this.pickaxeBaseHeight * cos;

        // center = true (по умолчанию) сам пересчитает offset, чтобы хитбокс
        // остался по центру спрайта при изменении размера.
        body.setSize(width, height);
    }

    // Отбрасывает кирку от точки взрыва динамита (sourceX/sourceY — мировые
    // координаты взорвавшегося блока). Это ДОБАВКА поверх обычного отскока
    // от удара, а не замена — вызывается один раз, только когда динамит
    // подорвали прямым ударом (см. destroyBlock).
    private applyExplosionKnockback(sourceX: number, sourceY: number) {
        const body = this.pickaxe.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        let dx = this.pickaxe.x - sourceX;
        let dy = this.pickaxe.y - sourceY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= len;
        dy /= len;

        body.velocity.x += dx * this.DYNAMITE_KNOCKBACK_FORCE;
        body.velocity.y += dy * this.DYNAMITE_KNOCKBACK_FORCE - this.DYNAMITE_KNOCKBACK_UPWARD_BONUS;

        // Взрыв заодно неплохо "крутит" кирку — небольшая случайная добавка
        // к вращению для той же аркадной непредсказуемости, что и у обычных
        // отскоков (см. SPIN_* выше).
        this.pickaxe.setAngularVelocity(
            body.angularVelocity + Phaser.Math.FloatBetween(-this.SPIN_MAX, this.SPIN_MAX) * 0.5
        );
    }

    private resolveMissedBlockOverlaps() {
        const body = this.pickaxe.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        const colFrom = Math.max(0, Math.floor((body.left - this.offsetX) / this.blockSize) - 1);
        const colTo = Math.min(this.cols - 1, Math.floor((body.right - this.offsetX) / this.blockSize) + 1);
        const rowFrom = Math.max(0, Math.floor((body.top - 150) / this.blockSize) - 1);
        const rowTo = Math.min(this.grid.length - 1, Math.floor((body.bottom - 150) / this.blockSize) + 1);

        for (let row = rowFrom; row <= rowTo; row++) {
            const gridRow = this.grid[row];
            if (!gridRow) continue;

            for (let col = colFrom; col <= colTo; col++) {
                const block = gridRow[col];
                if (!block || this.hitBlocksThisFrame.has(block)) continue;

                const bounds = block.sprite.getBounds();
                const overlapX = Math.min(body.right, bounds.right) - Math.max(body.left, bounds.left);
                const overlapY = Math.min(body.bottom, bounds.bottom) - Math.max(body.top, bounds.top);

                if (overlapX <= 0 || overlapY <= 0) continue;

                // Обычный коллайдер этот блок не засчитал — досчитываем удар вручную.
                this.onHitBlock(this.pickaxe, block.sprite);

                // Блок мог разрушиться от этого удара (в т.ч. цепной взрыв динамита) —
                // выталкивать уже нечего.
                if (!this.grid[row] || this.grid[row][col] !== block) continue;

                // Выталкиваем кирку из блока по оси наименьшего перекрытия, чтобы
                // она не оставалась "внутри" блока и не проходила сквозь него.
                if (overlapX < overlapY) {
                    const pushDir = body.center.x < (bounds.left + bounds.right) / 2 ? -1 : 1;
                    this.pickaxe.x += pushDir * overlapX;
                    if ((pushDir < 0 && body.velocity.x > 0) || (pushDir > 0 && body.velocity.x < 0)) {
                        this.pickaxe.setVelocityX(0);
                    }
                } else {
                    const pushDir = body.center.y < (bounds.top + bounds.bottom) / 2 ? -1 : 1;
                    this.pickaxe.y += pushDir * overlapY;
                    if ((pushDir < 0 && body.velocity.y > 0) || (pushDir > 0 && body.velocity.y < 0)) {
                        this.pickaxe.setVelocityY(0);
                    }
                }

                // Немедленно синхронизируем тело с новой позицией спрайта, чтобы
                // следующая итерация (если рядом ещё один "пропущенный" блок)
                // считала перекрытие уже от исправленной позиции.
                body.updateFromGameObject();
            }

            // Монолит не хранится в this.grid, поэтому без этой отдельной
            // проверки он был не виден страховке выше — из-за этого при
            // резком увеличении хитбокса кирки (бонус BUFF_SIZE) рядом с
            // монолитом она могла провалиться сквозь него точно так же, как
            // раньше проваливалась сквозь обычные блоки.
            const monolith = this.monolithRows[row];
            if (monolith) {
                this.resolveMonolithOverlap(monolith.left, body);
                this.resolveMonolithOverlap(monolith.right, body);
            }
        }
    }

    // Монолит неразрушим, поэтому здесь нет ни урона, ни уничтожения — только
    // гарантированный отскок (через onHitBlock, у которого без blockRef на
    // спрайте просто не сработает часть с уроном/разрушением) и выталкивание
    // кирки наружу, той же логикой, что и для обычных "пропущенных" блоков.
    private resolveMonolithOverlap(sprite: Phaser.Physics.Arcade.Sprite, body: Phaser.Physics.Arcade.Body) {
        if (!sprite || !sprite.active) return;

        const bounds = sprite.getBounds();
        const overlapX = Math.min(body.right, bounds.right) - Math.max(body.left, bounds.left);
        const overlapY = Math.min(body.bottom, bounds.bottom) - Math.max(body.top, bounds.top);

        if (overlapX <= 0 || overlapY <= 0) return;

        // Обычный коллайдер этот монолит в этом кадре не засчитал — досчитываем
        // "удар" вручную, чтобы кирка всегда получала физический отскок.
        this.onHitBlock(this.pickaxe, sprite);

        if (overlapX < overlapY) {
            const pushDir = body.center.x < (bounds.left + bounds.right) / 2 ? -1 : 1;
            this.pickaxe.x += pushDir * overlapX;
            if ((pushDir < 0 && body.velocity.x > 0) || (pushDir > 0 && body.velocity.x < 0)) {
                this.pickaxe.setVelocityX(0);
            }
        } else {
            const pushDir = body.center.y < (bounds.top + bounds.bottom) / 2 ? -1 : 1;
            this.pickaxe.y += pushDir * overlapY;
            if ((pushDir < 0 && body.velocity.y > 0) || (pushDir > 0 && body.velocity.y < 0)) {
                this.pickaxe.setVelocityY(0);
            }
        }

        body.updateFromGameObject();
    }

    private destroyBlock(x: number, y: number, isExplosion: boolean) {
        if (y >= this.grid.length || y < 0 || x >= this.cols || x < 0) return;
        let block = this.grid[y][x];
        if (!block) return;

        this.grid[y][x] = null;

        this.currentDepth = Math.max(this.currentDepth, block.y + 1);

        // Проверяем, не пробили ли новую веху глубины (см. onDepthMilestone).
        // while — на случай, если взрыв динамита сразу продвинул на несколько шагов.
        while (this.currentDepth >= this.nextMilestoneDepth) {
            this.onDepthMilestone(this.nextMilestoneDepth);
            this.nextMilestoneDepth += GAME_CONFIG.DEPTH_MILESTONE_STEP;
        }

        this.score += Math.floor(block.score * this.scoreMultiplier);

        // Воспроизведение индивидуального звука для земли/динамита, для всего
        // остального — обычный звук разрушения.
        if (block.type === BlockType.DIRT) {
            this.playDirtBreakSound(0.7);
        } else if (block.type === BlockType.DYNAMITE) {
            this.safePlaySound('bang', { volume: 0.9 });
        } else {
            this.playBlockBreakSound(0.7);
        }

        if (!isExplosion) {
            if (block.type === BlockType.FORGE) this.upgradePickaxe();
            else if (block.type === BlockType.BUFF_SIZE) this.applySizeBuff();
        }

        if (block.type === BlockType.DYNAMITE) {
            // Кирку физически отбрасывает взрывом — но только когда динамит
            // подорвали ПРЯМЫМ ударом кирки, а не когда он сдетонировал по
            // цепной реакции от соседнего взрыва (иначе при взрыве кластера
            // из нескольких зарядов динамита кирку расшвыривало бы сразу во все стороны).
            if (!isExplosion) {
                this.applyExplosionKnockback(block.sprite.x, block.sprite.y);
            }

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx !== 0 || dy !== 0) {
                        this.destroyBlock(x + dx, y + dy, true);
                    }
                }
            }
        }

        this.tweens.add({
            targets: [block.sprite, block.crackSprite],
            scale: 0, alpha: 0, duration: 150,
            onComplete: () => {
                block.sprite.destroy();
                block.crackSprite.destroy();
            }
        });
    }

    // Награда за новую личную рекордную глубину: разовый бонус к очкам (он уже
    // "в кармане" — сохранится, даже если кирка сломается через секунду) и
    // частичное восстановление прочности кирки — "второе дыхание", чтобы после
    // риска пойти глубже своего рекорда забег не обрывался слишком быстро.
    private onDepthMilestone(depth: number) {
        let bonus = Math.floor((GAME_CONFIG.MILESTONE_SCORE_BASE + depth * GAME_CONFIG.MILESTONE_SCORE_PER_DEPTH) * this.scoreMultiplier);
        this.score += bonus;

        let heal = Math.floor(this.maxPickaxeHp * GAME_CONFIG.MILESTONE_HEAL_RATIO);
        this.pickaxeHp = Math.min(this.maxPickaxeHp, this.pickaxeHp + heal);

        this.playBlockBreakSound(0.9);

        let popup = this.add.text(this.pickaxe.x, this.pickaxe.y - 70,
            t('milestone.text', { depth, bonus, heal }), {
            fontFamily: 'Courier', fontSize: '22px', color: '#ffd700', fontStyle: 'bold',
            align: 'center', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(90);

        this.tweens.add({
            targets: popup,
            y: popup.y - 90,
            alpha: 0,
            delay: 900,          // сначала спокойно висит на месте, полностью видимый
            duration: 900,       // и только потом уезжает вверх и гаснет
            ease: 'Cubic.easeIn',
            onComplete: () => popup.destroy()
        });

        this.updateUI();
    }

    private upgradePickaxe() {
        if (this.currentPickaxeLevel < 4) this.currentPickaxeLevel++;
        this.maxPickaxeHp = this.calculateMaxHp(this.currentPickaxeLevel);
        this.pickaxeHp = this.maxPickaxeHp;
        if (this.textures.exists(`pickaxe_${this.currentPickaxeLevel}`)) {
            this.pickaxe.setTexture(`pickaxe_${this.currentPickaxeLevel}`);
        }
    }

    private applySizeBuff() {
        if (this.sizeBuffEvent) this.sizeBuffEvent.remove();
        else this.pickaxe.setScale(3);

        this.sizeBuffEvent = this.time.addEvent({
            delay: 4000,
            callback: () => {
                this.pickaxe.setScale(2);
                this.sizeBuffEvent = null;
            }
        });
    }

    // Строит HUD-панель: каменная плашка сверху-слева (та же техника, что у
    // кнопок) вместо чёрного полупрозрачного прямоугольника с 6 строками
    // текста. Глубина, прочность (цветной бар) и счёт — крупно, потому что
    // именно на них игрок реагирует прямо сейчас; тип кирки/урон/множитель —
    // мелкой второстепенной строкой внизу. Кнопка "Забрать баланс" теперь
    // собрана через тот же createStoneButton, что и остальные кнопки игры, с
    // золотым акцентом вместо тревожного красного — это позитивное действие,
    // а не опасность.
    private buildHud() {
        const panelX = 200, panelY = 118, panelW = 380, panelH = 210;
        const contentLeft = panelX - panelW / 2 + 18;
        const contentRight = panelX + panelW / 2 - 18;

        const panel = createStonePanel(this, panelX, panelY, panelW, panelH);
        panel.setScrollFactor(0).setDepth(100);

        const rowDepthY = panelY - panelH / 2 + 26;
        const rowBarY = rowDepthY + 34;
        const rowScoreY = rowBarY + 32;
        // Кирка/уровень, урон и множитель — отдельные строки в столбик:
        // урон чуть ниже кирки, множитель ещё ниже урона.
        const rowPickaxeY = rowScoreY + 30;
        const rowDamageY = rowPickaxeY + 19;
        const rowMultY = rowDamageY + 19;

        this.hudDepthText = this.add.text(contentLeft, rowDepthY, '', statTextStyle('20px', '#ffffff', 4))
            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);

        // Рамка бара и число поверх неё — тот же серый "каменный" вид, что и
        // был; меняется только заливка внутри (см. StatBar.ts): она всегда
        // зелёная и просто показывает оставшуюся прочность длиной полосы.
        this.hudDurabilityBar = createStatBar(this, (contentLeft + contentRight) / 2, rowBarY, contentRight - contentLeft, 24);
        this.hudDurabilityBar.container.setScrollFactor(0).setDepth(101);

        this.hudDurabilityLabel = this.add.text((contentLeft + contentRight) / 2, rowBarY, '', statTextStyle('14px', '#ffffff', 3))
            .setOrigin(0.5).setScrollFactor(0).setDepth(102);

        addCoinIcon(this, contentLeft + 10, rowScoreY, 1).setScrollFactor(0).setDepth(101);
        this.hudScoreText = this.add.text(contentLeft + 30, rowScoreY, '', statTextStyle('22px', '#ffd700', 4))
            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);

        this.hudPickaxeText = this.add.text(contentLeft, rowPickaxeY, '', secondaryTextStyle('14px'))
            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
        this.hudDamageText = this.add.text(contentLeft, rowDamageY, '', secondaryTextStyle('14px'))
            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
        this.hudMultiplierText = this.add.text(contentLeft, rowMultY, '', secondaryTextStyle('14px'))
            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);

        const exitButton = createStoneButton(this, 1400, 60, 260, 64, t('hud.claimBalance'), () => {
            this.claimBalanceAndExit();
        }, '18px', { accentColor: ACCENT.gold });
        exitButton.container.setScrollFactor(0).setDepth(100);

        // Кнопки звука/полноэкранного режима — ниже кнопки "ЗАБРАТЬ
        // БАЛАНС" (та занимает y 28-92), чтобы не перекрываться с ней.
        createUtilityButtons(this, 1470, 140);
    }

    private updateUI() {
        let stat = PICKAXE_LEVELS[this.currentPickaxeLevel];
        let totalDamage = this.calculateDamage(this.currentPickaxeLevel);

        this.hudDepthText.setText(t('hud.depth', { depth: this.currentDepth, record: this.pData.maxDepth }));

        this.hudDurabilityBar.setValue(this.pickaxeHp, this.maxPickaxeHp);
        this.hudDurabilityLabel.setText(`${this.pickaxeHp}/${this.maxPickaxeHp}`);

        this.hudScoreText.setText(t('hud.score', { value: this.score }));

        this.hudPickaxeText.setText(t('hud.pickaxe', { name: t(stat.nameKey), level: stat.level }));
        this.hudDamageText.setText(t('hud.damage', { value: totalDamage }));
        this.hudMultiplierText.setText(t('hud.multiplier', { value: this.scoreMultiplier.toFixed(2) }));
    }

    // Сохраняет результат забега (баланс, лучшую глубину, счётчик добытых
    // за всю игру монет) и отправляет рекорд глубины в таблицу лидеров
    // Яндекс Игр (если игра запущена там и игрок авторизован — иначе
    // submitLeaderboardScore просто тихо ничего не делает).
    private saveRunResults(): PlayerData {
        let currentState = SaveSystem.load();
        currentState.balance += this.score;
        currentState.totalCoinsMined += this.score;
        currentState.maxDepth = Math.max(currentState.maxDepth, this.currentDepth);
        SaveSystem.save(currentState);

        submitLeaderboardScore(currentState.maxDepth, currentState.totalCoinsMined);

        return currentState;
    }

    // Не показывать полноэкранную (interstitial) рекламу после ОЧЕНЬ
    // коротких забегов (быстрая смерть/рестарт) — иначе при частых
    // рестартах реклама выскакивала бы почти после каждого клика и
    // раздражала бы игрока. Порог и сама частота показа (после КАЖДОГО
    // забега длиннее порога, без дополнительного отдельного "остывания")
    // — наше собственное решение по балансу дохода/раздражения: сам SDK
    // Яндекс Игр частоту показа interstitial никак не ограничивает (см.
    // https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv).
    private readonly INTERSTITIAL_MIN_RUN_MS = 37000;

    // Единая точка выхода в главное меню из забега — и по кнопке "ЗАБРАТЬ
    // БАЛАНС" (claimBalanceAndExit), и с экрана поражения (checkGameOver).
    // Показывает полноэкранную рекламу (если забег был не совсем коротким
    // — см. INTERSTITIAL_MIN_RUN_MS) и уже ПОСЛЕ её закрытия переходит в
    // меню — как и остальные обёртки над SDK в этой игре (см.
    // GameplayApi.ts/Leaderboard.ts), никогда не блокирует игрока и не
    // бросает исключений наружу, если реклама недоступна или произошла
    // ошибка: в любом случае игрок попадёт в меню.
    private returnToMenu() {
        const goToMenu = () => this.scene.start('MainMenuScene');

        const runDurationMs = this.game.loop.time - this.runStartTime;
        const ysdk = (window as any).ysdk;

        if (runDurationMs < this.INTERSTITIAL_MIN_RUN_MS || typeof ysdk === 'undefined' || ysdk === null) {
            goToMenu();
            return;
        }

        try {
            ysdk.adv.showFullscreenAdv({
                callbacks: {
                    onOpen: () => {
                        // Требование Яндекс Игр (п. 4.7): во время показа
                        // полноэкранной рекламы звук и игровой процесс
                        // должны быть на паузе — геймплей уже остановлен
                        // (физика кирки отключена, sound.stopAll()
                        // вызван до returnToMenu()), setAdOverlayOpen
                        // нужен, чтобы глобальный обработчик потери фокуса
                        // (см. SoundPrefs.ts) не попытался возобновить звук
                        // поверх ещё не закрытой рекламы.
                        setAdOverlayOpen(true);
                    },
                    onClose: () => {
                        setAdOverlayOpen(false);
                        goToMenu();
                    },
                    onError: (e: any) => {
                        setAdOverlayOpen(false);
                        console.error('Yandex Ads Error (interstitial):', e);
                        goToMenu();
                    }
                }
            });
        } catch (e) {
            // SDK недоступен/локальная разработка — не критично, просто
            // идём в меню без рекламы.
            goToMenu();
        }
    }

    private claimBalanceAndExit() {
        let physicsBody = this.pickaxe.body as Phaser.Physics.Arcade.Body;
        physicsBody.stop();
        physicsBody.enable = false;

        // Требование Яндекс Игр (см. GameplayApi.ts): игрок сам завершил
        // забег и уходит в меню — активный геймплей закончился.
        setGameplayWantsActive(false);

        this.sound.stopAll();

        this.saveRunResults();

        this.returnToMenu();
    }

    private checkGameOver() {
        if (this.pickaxeHp <= 0) {
            let physicsBody = this.pickaxe.body as Phaser.Physics.Arcade.Body;
            physicsBody.stop();
            physicsBody.enable = false;

            // Требование Яндекс Игр (см. GameplayApi.ts): кирка сломалась —
            // игрок смотрит экран поражения, это уже не активный геймплей
            // (снова станет true, если реклама восстановит HP — см. onClose
            // ниже).
            setGameplayWantsActive(false);

            this.sound.stopAll();
            this.safePlaySound('sfx_destroy', { volume: 1.0 });

            const gameOverContainer = this.add.container(800, this.cameras.main.scrollY + 450).setDepth(100);

            let goText = this.add.text(0, -60, t('gameover.text', { score: this.score }), {
                fontFamily: 'Courier', fontSize: '36px', color: '#ff2222', backgroundColor: '#000000ee',
                padding: { x: 20, y: 10 }, align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setStroke('#fff', 2);

            this.tweens.add({ targets: goText, scale: 1.05, yoyo: true, repeat: -1, duration: 800 });

            goText.on('pointerdown', () => {
                this.saveRunResults();
                // Тот же переход, что и при досрочном выводе баланса (см.
                // claimBalanceAndExit) — interstitial-реклама после забегов
                // длиннее INTERSTITIAL_MIN_RUN_MS, см. returnToMenu().
                this.returnToMenu();
            });

            gameOverContainer.add(goText);

            if (typeof (window as any).ysdk !== 'undefined' && (window as any).ysdk !== null) {
                let rewardBtn = this.add.rectangle(0, 60, 480, 60, 0x4CAF50)
                    .setInteractive({ useHandCursor: true }).setStrokeStyle(3, 0xffffff);

                let rewardText = this.add.text(0, 60, t('gameover.reviveAd'), {
                    fontFamily: 'Courier', fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
                }).setOrigin(0.5);

                gameOverContainer.add([rewardBtn, rewardText]);

                rewardBtn.on('pointerdown', () => {
                    (window as any).ysdk.adv.showRewardedVideo({
                        callbacks: {
                            onOpen: () => {
                                setAdOverlayOpen(true);
                                this.sound.pauseAll();
                            },
                            onRewarded: () => {
                                this.pickaxeHp = this.maxPickaxeHp;
                            },
                            onClose: () => {
                                setAdOverlayOpen(false);
                                this.sound.resumeAll();
                                if (this.pickaxeHp > 0) {
                                    // Реклама восстановила HP — забег
                                    // продолжается, геймплей снова активен.
                                    setGameplayWantsActive(true);
                                    gameOverContainer.destroy();
                                    physicsBody.enable = true;
                                    this.pickaxe.setVelocityY(-250);
                                    this.updateUI();
                                }
                            },
                            onError: (e: any) => {
                                setAdOverlayOpen(false);
                                console.error('Yandex Ads Error:', e);
                            }
                        }
                    });
                });
            }
        }
    }

    private safePlaySound(key: string, config?: Phaser.Types.Sound.SoundConfig) {
        try {
            if (this.cache.audio.exists(key)) {
                this.sound.play(key, config);
            }
        } catch (e) {}
    }

    //
    // ЭКСПЕРИМЕНТАЛЬНОЕ значение — подбирайте на слух:
    private readonly HIT_SOUND_MIN_GAP_MS = 10;
    private lastHitSoundAt = 0;

    // Задержка для звука разрушения ЗЕМЛИ — своя, отдельная от звука удара
    // и от звука разрушения обычных блоков. Без неё при взрыве динамита или
    // быстром "прокапывании" земли несколько одинаковых коротких сэмплов
    // могли запускаться почти одновременно и накладывались друг на друга,
    // из-за чего звук казался "размазанным"/рассинхронизированным.
    // ЭКСПЕРИМЕНТАЛЬНОЕ значение — подбирайте на слух:
    private readonly DIRT_BREAK_SOUND_MIN_GAP_MS = 2;
    private lastDirtBreakSoundAt = 0;

    // То же самое, но для звука разрушения обычных блоков (камень и всё,
    // что использует sfx_break) — своя задержка, независимая от земли и
    // от звука удара.
    // ЭКСПЕРИМЕНТАЛЬНОЕ значение — подбирайте на слух:
    private readonly BLOCK_BREAK_SOUND_MIN_GAP_MS = 2;
    private lastBlockBreakSoundAt = 0;

    private playHitSound() {
        const now = this.time.now;
        if (now - this.lastHitSoundAt < this.HIT_SOUND_MIN_GAP_MS) return;
        this.lastHitSoundAt = now;
        this.safePlaySound('sfx_hit', { volume: 0.5 });
    }

    private playDirtBreakSound(volume: number) {
        const now = this.time.now;
        if (now - this.lastDirtBreakSoundAt < this.DIRT_BREAK_SOUND_MIN_GAP_MS) return;
        this.lastDirtBreakSoundAt = now;
        this.safePlaySound('sfx_dirt', { volume });
    }

    private playBlockBreakSound(volume: number) {
        const now = this.time.now;
        if (now - this.lastBlockBreakSoundAt < this.BLOCK_BREAK_SOUND_MIN_GAP_MS) return;
        this.lastBlockBreakSoundAt = now;
        this.safePlaySound('sfx_break', { volume });
    }

    private createFallbackTextures() {
        if (!this.textures.exists('fallback_bg')) {
            let g = this.make.graphics({ x: 0, y: 0 });
            g.fillStyle(0x1a1a24, 1); g.fillRect(0, 0, 100, 100);
            g.generateTexture('fallback_bg', 100, 100);
            g.destroy();
        }
        if (!this.textures.exists('fallback_block')) {
            let g = this.make.graphics({ x: 0, y: 0 });
            g.fillStyle(0x666666, 1); g.fillRect(0, 0, 100, 100);
            g.lineStyle(2, 0x000000, 1); g.strokeRect(0, 0, 100, 100);
            g.generateTexture('fallback_block', 100, 100);
            g.destroy();
        }
        if (!this.textures.exists('fallback_pickaxe')) {
            let g = this.make.graphics({ x: 0, y: 0 });
            g.fillStyle(0x00ffff, 1); g.fillRect(0, 0, 30, 30);
            g.generateTexture('fallback_pickaxe', 30, 30);
            g.destroy();
        }
    }
}
