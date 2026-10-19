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

// Баланс и прокачка
export const GAME_CONFIG = {
    BASE_HP_START: 100,
    HP_PER_UPGRADE: 10,
    BASE_DMG_START: 10,
    DMG_PER_UPGRADE: 1,
    SCORE_MULT_PER_UPGRADE: 0.075,
    ORE_BONUS_PER_UPGRADE: 1,
    // +8% к шансу кузницы за уровень прокачки
    FORGE_BONUS_PER_UPGRADE: 0.08,

    // Вехи: награда каждые N блоков глубины за личным рекордом
    DEPTH_MILESTONE_STEP: 20,
    MILESTONE_SCORE_BASE: 50,
    MILESTONE_SCORE_PER_DEPTH: 2,   // очков за каждый блок глубины
    MILESTONE_HEAL_RATIO: 0.1,      // доля макс. прочности, которую восстанавливает веха

    // Разгон темпа: игровое время ускоряется с длительностью забега
    // (см. updateGameSpeed). На сложность и звук не влияет.
    SPEED_RAMP_PER_SECOND: 0.12, // прирост множителя скорости в секунду; 0 — без разгона
    SPEED_RAMP_MAX: 12
};

enum BlockType {
    DIRT, STONE, FORGE, BUFF_SIZE, DYNAMITE,
    ORE_COAL, ORE_GOLD, ORE_EMERALD, ORE_DIAMOND,
    ORE_IRON, ORE_RUBY
}

// Здесь ключ перевода, а не строка: модуль загружается до определения языка.
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
    // Руды от частой к редкой: HP x1.5, очки x2.35 на каждый уровень редкости.
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
    private forgeBonus = 0;
    private runStartTime = 0;

    private hudDepthText!: Phaser.GameObjects.Text;
    private hudDurabilityBar!: StatBarHandle;
    private hudDurabilityLabel!: Phaser.GameObjects.Text;
    private hudScoreText!: Phaser.GameObjects.Text;
    private hudPickaxeText!: Phaser.GameObjects.Text;
    private hudDamageText!: Phaser.GameObjects.Text;
    private hudMultiplierText!: Phaser.GameObjects.Text;
    private pickaxe!: Phaser.Physics.Arcade.Sprite;
    // Хитбокс кирки без поворота. При смене текстуры подбирать с physics.arcade.debug = true.
    private readonly pickaxeBaseWidth = 35;
    private readonly pickaxeBaseHeight = 50;

    // Отскок кирки от блоков по горизонтали
    private readonly BOUNCE_MOMENTUM_KEEP = 0.62;   // доля скорости, сохраняемая при ударе
    private readonly BOUNCE_BASE_IMPULSE = 70;      // базовый толчок от блока
    private readonly BOUNCE_OFFSET_IMPULSE = 1.6;   // добавка за удар не по центру блока
    private readonly BOUNCE_RANDOM_JITTER = 28;     // случайный разброс толчка
    private readonly BOUNCE_MAX_VX_DELTA = 140;     // макс. изменение скорости за удар, чтобы не разворачивало рывком
    private readonly BOUNCE_MAX_VX = 300;
    private readonly BOUNCE_MIN_VY = 40;            // ниже этой скорости гасим дребезг на стыках блоков

    // Должно совпадать с gravity.y в main.ts
    private readonly BASE_GRAVITY_Y = 520;
    private readonly BASE_MAX_VX = 350;
    private readonly BASE_MAX_VY = 1200;

    // Вращение кирки
    private readonly SPIN_FROM_VX = 1.8;
    private readonly SPIN_MAX = 480;
    private readonly SPIN_RANDOM_JITTER = 35;
    // Плавность смены вращения за удар (0..1)
    private readonly SPIN_SMOOTHING = 0.5;

    // Отдача от взрыва динамита при прямом ударе
    private readonly DYNAMITE_KNOCKBACK_FORCE = 260;
    private readonly DYNAMITE_KNOCKBACK_UPWARD_BONUS = 80;  // всегда подбрасывает вверх

    private blocksGroup!: Phaser.Physics.Arcade.StaticGroup;
    private sizeBuffEvent: Phaser.Time.TimerEvent | null = null;

    private columnVeins: (VeinState | null)[] = [];
    // Монолиты по краям строк; индекс совпадает с this.grid.
    private monolithRows: { left: Phaser.Physics.Arcade.Sprite; right: Phaser.Physics.Arcade.Sprite }[] = [];
    // Блоки, удар по которым уже засчитан коллайдером в этом кадре.
    private hitBlocksThisFrame: Set<BlockData> = new Set();
    private nextMilestoneDepth = 0;

    constructor() { super('GameScene'); }

    // (базовое HP) * уровень кирки
    private calculateMaxHp(level: number): number {
        const baseHp = GAME_CONFIG.BASE_HP_START + (this.pData.lvlHp * GAME_CONFIG.HP_PER_UPGRADE);
        return baseHp * level;
    }

    // (базовый урон) * уровень кирки
    private calculateDamage(level: number): number {
        const baseDamage = GAME_CONFIG.BASE_DMG_START + (this.pData.lvlDamage * GAME_CONFIG.DMG_PER_UPGRADE);
        return baseDamage * level;
    }

    // Шанс руды в промилле: 0 до unlockDepth, затем растёт от minChance
    // до maxChance за rampBlocks блоков.
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
        this.load.audio('sfx_dirt', 'assets/audio/sfx_dirt.mp3');
        this.load.audio('sfx_destroy', 'assets/audio/sfx_destroy.mp3');
        this.load.audio('click-menu', 'assets/audio/click-menu.mp3');
        this.load.audio('bang', 'assets/audio/bang.mp3');
    }

    create() {
        setGameplayWantsActive(true);

        this.createFallbackTextures();

        // game.loop.time, а не this.time.now: часы сцены стоят, пока она
        // неактивна, и в create() ещё показывают время конца прошлого забега.
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

    // Ускоряет игровое время через timeScale (см. GAME_CONFIG.SPEED_RAMP_*).
    // У physics.world.timeScale направление обратное: 0.5 — вдвое быстрее,
    // поэтому туда идёт 1 / speedMultiplier. У tweens и time — обычное.
    private updateGameSpeed() {
        if (GAME_CONFIG.SPEED_RAMP_PER_SECOND <= 0) return;

        const elapsedSeconds = (this.time.now - this.runStartTime) / 1000;
        const speedMultiplier = Math.min(
            GAME_CONFIG.SPEED_RAMP_MAX,
            1 + elapsedSeconds * GAME_CONFIG.SPEED_RAMP_PER_SECOND
        );

        this.physics.world.timeScale = 1 / speedMultiplier;
        this.tweens.timeScale = speedMultiplier;
        this.time.timeScale = speedMultiplier;
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
                    let r2 = Phaser.Math.Between(0, 999);

                    // Прокачка руд умножает шансы всех руд одинаково,
                    // порядок редкости не меняется.
                    let oreBoostMult = 1 + this.oreBonus * 0.05;
                    let chanceCoal = this.getGatedOreChance(y, 6, 18, 45, 110) * oreBoostMult;
                    let chanceIron = this.getGatedOreChance(y, 12, 20, 25, 70) * oreBoostMult;
                    let chanceGold = this.getGatedOreChance(y, 20, 24, 15, 45) * oreBoostMult;
                    let chanceRuby = this.getGatedOreChance(y, 30, 26, 9, 28) * oreBoostMult;
                    let chanceDiamond = this.getGatedOreChance(y, 42, 28, 5, 16) * oreBoostMult;
                    let chanceEmerald = this.getGatedOreChance(y, 58, 32, 3, 9) * oreBoostMult;

                    // Ограничиваем сумму шансов руд, чтобы оставалось ~10% камня.
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
                    // Базовый шанс кузницы 10 из 1000, потолок 40 — страховка на будущее.
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
            // Трава только на верхнем слое, ниже DIRT рисуется текстурой dirt.
            let desiredTexture = (type === BlockType.DIRT && y > 0) ? 'dirt' : def.texture;
            let texKey = this.textures.exists(desiredTexture) ? desiredTexture : 'fallback_block';

            let sprite = this.blocksGroup.create(posX, posY, texKey) as Phaser.Physics.Arcade.Sprite;
            sprite.setDisplaySize(this.blockSize - 2, this.blockSize - 2).setDepth(10).refreshBody();

            let crackTex = this.textures.exists('crack_1') ? 'crack_1' : 'fallback_block';
            let crackSprite = this.add.sprite(posX, posY, crackTex)
                .setDisplaySize(this.blockSize - 2, this.blockSize - 2)
                .setAlpha(0)
                .setDepth(20);

            // +2.5% прочности блока за каждый ряд глубины
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

        let hitSign = diffX === 0 ? (Phaser.Math.Between(0, 1) ? 1 : -1) : Math.sign(diffX);
        let impulseX = hitSign * this.BOUNCE_BASE_IMPULSE
            + diffX * this.BOUNCE_OFFSET_IMPULSE
            + Phaser.Math.FloatBetween(-this.BOUNCE_RANDOM_JITTER, this.BOUNCE_RANDOM_JITTER);

        let desiredVx = vx * this.BOUNCE_MOMENTUM_KEEP + impulseX;

        let newVx = Phaser.Math.Clamp(desiredVx, vx - this.BOUNCE_MAX_VX_DELTA, vx + this.BOUNCE_MAX_VX_DELTA);
        newVx = Phaser.Math.Clamp(newVx, -this.BOUNCE_MAX_VX, this.BOUNCE_MAX_VX);

        this.pickaxe.setVelocityX(newVx);

        let targetSpin = Phaser.Math.Clamp(newVx * this.SPIN_FROM_VX, -this.SPIN_MAX, this.SPIN_MAX)
            + Phaser.Math.FloatBetween(-this.SPIN_RANDOM_JITTER, this.SPIN_RANDOM_JITTER);
        this.pickaxe.setAngularVelocity(
            Phaser.Math.Linear(physicsBody.angularVelocity, targetSpin, this.SPIN_SMOOTHING)
        );

        if (physicsBody.touching.up && Math.abs(physicsBody.velocity.y) < this.BOUNCE_MIN_VY) {
            this.pickaxe.setVelocityY(0);
        }

        let blockData = spriteObj.getData('blockRef') as BlockData;
        if (!blockData) {
            // Монолит неразрушим, поэтому всегда звук удара.
            this.playHitSound();
            return;
        }

        this.hitBlocksThisFrame.add(blockData);

        let totalDamage = this.calculateDamage(this.currentPickaxeLevel);
        blockData.hp -= totalDamage;

        // +1 к износу кирки за каждые 25 рядов глубины
        let depthPenalty = Math.floor(blockData.y / 25);
        this.pickaxeHp = Math.max(0, this.pickaxeHp - (1 + depthPenalty));

        this.tweens.add({ targets: [blockData.sprite, blockData.crackSprite], scale: 0.85, yoyo: true, duration: 60 });

        if (blockData.hp <= 0) {
            // Звук удара не играем, будет только звук разрушения.
            this.destroyBlock(blockData.x, blockData.y, false);
        } else {
            this.playHitSound();

            let ratio = blockData.hp / blockData.maxHp;
            if (this.textures.exists('crack_3') && ratio <= 0.33) blockData.crackSprite.setTexture('crack_3').setAlpha(1);
            else if (this.textures.exists('crack_2') && ratio <= 0.66) blockData.crackSprite.setTexture('crack_2').setAlpha(1);
            else if (this.textures.exists('crack_1') && ratio < 1.0) blockData.crackSprite.setTexture('crack_1').setAlpha(1);
        }

        this.updateUI();
        this.checkGameOver();
    }

    // Arcade Physics не поворачивает хитбокс: берём габаритный прямоугольник
    // повёрнутого pickaxeBaseWidth x pickaxeBaseHeight.
    private updatePickaxeHitbox() {
        const body = this.pickaxe.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        const rad = this.pickaxe.rotation;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));

        const width = this.pickaxeBaseWidth * cos + this.pickaxeBaseHeight * sin;
        const height = this.pickaxeBaseWidth * sin + this.pickaxeBaseHeight * cos;

        body.setSize(width, height);
    }

    // Отбрасывает кирку от взорвавшегося динамита (добавка к обычному отскоку).
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

        this.pickaxe.setAngularVelocity(
            body.angularVelocity + Phaser.Math.FloatBetween(-this.SPIN_MAX, this.SPIN_MAX) * 0.5
        );
    }

    // Страховка от провала кирки сквозь блок. Если хитбокс резко вырос
    // (бонус BUFF_SIZE), Arcade Physics может считать тела вложенными и не
    // вызвать столкновение. Проверяем пересечения вручную и выталкиваем кирку.
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

                this.onHitBlock(this.pickaxe, block.sprite);

                // Блок мог разрушиться от этого удара
                if (!this.grid[row] || this.grid[row][col] !== block) continue;

                // Выталкиваем по оси наименьшего перекрытия
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

            // Монолиты не в this.grid, проверяем отдельно
            const monolith = this.monolithRows[row];
            if (monolith) {
                this.resolveMonolithOverlap(monolith.left, body);
                this.resolveMonolithOverlap(monolith.right, body);
            }
        }
    }

    // То же для монолита: только отскок и выталкивание, без урона.
    private resolveMonolithOverlap(sprite: Phaser.Physics.Arcade.Sprite, body: Phaser.Physics.Arcade.Body) {
        if (!sprite || !sprite.active) return;

        const bounds = sprite.getBounds();
        const overlapX = Math.min(body.right, bounds.right) - Math.max(body.left, bounds.left);
        const overlapY = Math.min(body.bottom, bounds.bottom) - Math.max(body.top, bounds.top);

        if (overlapX <= 0 || overlapY <= 0) return;

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

        // while — взрыв может пройти сразу несколько вех
        while (this.currentDepth >= this.nextMilestoneDepth) {
            this.onDepthMilestone(this.nextMilestoneDepth);
            this.nextMilestoneDepth += GAME_CONFIG.DEPTH_MILESTONE_STEP;
        }

        this.score += Math.floor(block.score * this.scoreMultiplier);

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
            // Отдача только от прямого удара, не от цепной реакции
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

    // Награда за новую рекордную глубину: бонус очков и частичное лечение кирки.
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
            delay: 900,
            duration: 900,
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

    private buildHud() {
        const panelX = 200, panelY = 118, panelW = 380, panelH = 210;
        const contentLeft = panelX - panelW / 2 + 18;
        const contentRight = panelX + panelW / 2 - 18;

        const panel = createStonePanel(this, panelX, panelY, panelW, panelH);
        panel.setScrollFactor(0).setDepth(100);

        const rowDepthY = panelY - panelH / 2 + 26;
        const rowBarY = rowDepthY + 34;
        const rowScoreY = rowBarY + 32;
        const rowPickaxeY = rowScoreY + 30;
        const rowDamageY = rowPickaxeY + 19;
        const rowMultY = rowDamageY + 19;

        this.hudDepthText = this.add.text(contentLeft, rowDepthY, '', statTextStyle('20px', '#ffffff', 4))
            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);

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

        // Ниже кнопки "Забрать баланс"
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

    // Сохраняет результат забега и отправляет рекорд в лидерборд.
    private saveRunResults(): PlayerData {
        let currentState = SaveSystem.load();
        currentState.balance += this.score;
        currentState.totalCoinsMined += this.score;
        currentState.maxDepth = Math.max(currentState.maxDepth, this.currentDepth);
        SaveSystem.save(currentState);

        submitLeaderboardScore(currentState.maxDepth, currentState.totalCoinsMined);

        return currentState;
    }

    // После забегов короче этого полноэкранная реклама не показывается.
    private readonly INTERSTITIAL_MIN_RUN_MS = 37000;

    // Выход в меню: после рекламы (если забег был достаточно длинным) или сразу.
    // При ошибке рекламы игрок всё равно попадает в меню.
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
                        // Яндекс Игры (п. 4.7): во время рекламы звук на паузе.
                        // Флаг не даёт обработчику фокуса включить звук поверх рекламы.
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
            goToMenu();
        }
    }

    private claimBalanceAndExit() {
        let physicsBody = this.pickaxe.body as Phaser.Physics.Arcade.Body;
        physicsBody.stop();
        physicsBody.enable = false;

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

    // Минимальные интервалы между одинаковыми звуками, чтобы они не накладывались
    // (например, при взрыве динамита). Подбираются на слух.
    private readonly HIT_SOUND_MIN_GAP_MS = 10;
    private lastHitSoundAt = 0;

    private readonly DIRT_BREAK_SOUND_MIN_GAP_MS = 2;
    private lastDirtBreakSoundAt = 0;

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
