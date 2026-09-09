import Phaser from 'phaser';
import { SaveSystem, type PlayerData } from './MenuScene';

// Глобальная конфигурация баланса и прокачки
export const GAME_CONFIG = {
    BASE_HP_START: 50,          // Начальное базовое HP
    HP_PER_UPGRADE: 5,          // Шаг прибавки HP за уровень (поменяйте на 3 для +3 HP)
    BASE_DMG_START: 10,         // Начальный базовый урон
    DMG_PER_UPGRADE: 1,         // Шаг прибавки урона за уровень
    SCORE_MULT_PER_UPGRADE: 0.02, // Прибавка к множителю очков (+5% за уровень)
    ORE_BONUS_PER_UPGRADE: 1    // Коэффициент частоты спавна руд
};

enum BlockType { 
    DIRT, STONE, WORKBENCH, BUFF_SIZE, TNT, 
    ORE_COAL, ORE_GOLD, ORE_EMERALD, ORE_DIAMOND 
}

interface PickaxeStat { name: string; level: number; color: number; }

const PICKAXE_LEVELS: Record<number, PickaxeStat> = {
    1: { name: 'Деревянная', level: 1, color: 0x8B4513 },
    2: { name: 'Каменная', level: 2, color: 0xC0C0C0 },
    3: { name: 'Железная', level: 3, color: 0xC0C0C0 },
    4: { name: 'Алмазная', level: 4, color: 0x00FFFF }
};

interface BlockDef { hp: number; score: number; texture: string; isOre: boolean; veinMin: number; veinMax: number; }

const BLOCKS: Record<number, BlockDef> = {
    [BlockType.DIRT]: { hp: 5, score: 0, texture: 'grass', isOre: false, veinMin: 0, veinMax: 0 },
    [BlockType.STONE]: { hp: 10, score: 0, texture: 'cobblestone', isOre: false, veinMin: 0, veinMax: 0 },
    [BlockType.WORKBENCH]: { hp: 5, score: 0, texture: 'workbench', isOre: false, veinMin: 0, veinMax: 0 },
    [BlockType.BUFF_SIZE]: { hp: 5, score: 0, texture: 'buff_size', isOre: false, veinMin: 0, veinMax: 0 },
    [BlockType.TNT]: { hp: 5, score: 0, texture: 'tnt', isOre: false, veinMin: 0, veinMax: 0 },
    [BlockType.ORE_COAL]: { hp: 15, score: 20, texture: 'coal_ore', isOre: true, veinMin: 3, veinMax: 6 },
    [BlockType.ORE_GOLD]: { hp: 30, score: 300, texture: 'gold_ore', isOre: true, veinMin: 3, veinMax: 5 },
    [BlockType.ORE_DIAMOND]: { hp: 60, score: 700, texture: 'diamond_ore', isOre: true, veinMin: 1, veinMax: 2 },
    [BlockType.ORE_EMERALD]: { hp: 100, score: 1500, texture: 'emerald_block', isOre: true, veinMin: 1, veinMax: 2 }
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

    private uiText!: Phaser.GameObjects.Text;
    private pickaxe!: Phaser.Physics.Arcade.Sprite;
    private blocksGroup!: Phaser.Physics.Arcade.StaticGroup;
    private bg!: Phaser.GameObjects.TileSprite;
    private sizeBuffEvent: Phaser.Time.TimerEvent | null = null;
    
    private columnVeins: (VeinState | null)[] = [];

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

    init(data: PlayerData) {
        this.pData = data || { balance: 0, lvlHp: 0, lvlMult: 0, lvlOre: 0, lvlDamage: 0, maxDepth: 0 };
        
        this.currentPickaxeLevel = 1;
        this.maxPickaxeHp = this.calculateMaxHp(this.currentPickaxeLevel);
        this.pickaxeHp = this.maxPickaxeHp;
        
        this.scoreMultiplier = 1.0 + (this.pData.lvlMult * GAME_CONFIG.SCORE_MULT_PER_UPGRADE);
        this.oreBonus = this.pData.lvlOre * GAME_CONFIG.ORE_BONUS_PER_UPGRADE;

        this.score = 0;
        this.currentDepth = 0;
        this.grid = [];
        this.currentRowIdx = 0;
        this.sizeBuffEvent = null;
        this.columnVeins = Array(this.cols).fill(null);
    }

    preload() {
        const textures = ['grass', 'cobblestone', 'workbench', 'buff_size', 'tnt', 'coal_ore', 'gold_ore', 'emerald_block', 'diamond_ore'];
        textures.forEach(key => this.load.image(key, `src/assets/${key}.png`));

        for (let i = 1; i <= 4; i++) this.load.image(`pickaxe_${i}`, `src/assets/pickaxe_${i}.png`);
        for (let i = 1; i <= 3; i++) this.load.image(`crack_${i}`, `src/assets/crack_${i}.png`);

        this.load.image('bg_mine', 'src/assets/bg_mine.png');
        this.load.image('bedrock', 'src/assets/bedrock.png');
        
        this.load.audio('bgm_mine', 'src/assets/audio/bgm_mine.mp3');
        this.load.audio('sfx_hit', 'src/assets/audio/sfx_hit.mp3');
        this.load.audio('sfx_break', 'src/assets/audio/sfx_break.mp3');
        this.load.audio('sfx_dirt', 'src/assets/audio/sfx_dirt.mp3'); // Звук разрушения земли
        this.load.audio('sfx_destroy', 'src/assets/audio/sfx_destroy.mp3');
    }

    create() {
        this.createFallbackTextures();

        let bgTexture = this.textures.exists('bg_mine') ? 'bg_mine' : 'fallback_bg';
        this.bg = this.add.tileSprite(800, 450, 1600, 900, bgTexture)
            .setScrollFactor(0)
            .setDepth(-100);

        this.blocksGroup = this.physics.add.staticGroup();

        let pickaxeTex = this.textures.exists(`pickaxe_${this.currentPickaxeLevel}`) 
            ? `pickaxe_${this.currentPickaxeLevel}` 
            : 'fallback_pickaxe';

        this.pickaxe = this.physics.add.sprite(this.offsetX + 300, 50, pickaxeTex);
        this.pickaxe.setScale(2); 
        this.pickaxe.setSize(50, 65); 
        this.pickaxe.setDepth(50);
        
        this.pickaxe.setBounce(0.65, 0.65);
        this.pickaxe.setCollideWorldBounds(true);
        this.pickaxe.setMaxVelocity(350, 1200);
        this.pickaxe.setDragX(80);
        this.pickaxe.setAngularVelocity(250);

        this.physics.world.setBounds(0, 0, 1600, Number.MAX_SAFE_INTEGER);
        this.physics.add.collider(this.pickaxe, this.blocksGroup, this.onHitBlock as any, undefined, this);

        this.uiText = this.add.text(10, 10, '', { 
            fontFamily: 'Courier', fontSize: '20px', color: '#fff', 
            backgroundColor: '#000000cc', padding: { x: 10, y: 10 } 
        }).setDepth(100).setScrollFactor(0).setStroke('#000', 3);

        const exitBtn = this.add.rectangle(1400, 50, 250, 50, 0xcc0000)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0).setDepth(100).setStrokeStyle(2, 0xffffff);
            
        this.add.text(1400, 50, 'ЗАБРАТЬ БАЛАНС', { 
            fontFamily: 'Courier', fontSize: '20px', color: '#ffffff', fontStyle: 'bold' 
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

        exitBtn.on('pointerdown', () => this.claimBalanceAndExit());

        this.updateUI();

        for (let i = 0; i < 15; i++) {
            this.generateRow();
        }

        this.sound.stopAll();
        this.safePlaySound('bgm_mine', { loop: true, volume: 0.15 });
    }

    update() {
        if (this.pickaxeHp <= 0) return;
        
        let targetY = this.pickaxe.y - 300;
        if (targetY > this.cameras.main.scrollY) {
            this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetY, 0.1);
        }

        if (this.pickaxe.y > this.currentRowIdx * this.blockSize - 1000) {
            this.generateRow();
        }
    }

    private generateRow() {
        let row: (BlockData | null)[] = [];
        let y = this.currentRowIdx;
        let leftVein: VeinState | null = null;
        let posY = y * this.blockSize + this.blockSize / 2 + 150;

        let bedrockTex = this.textures.exists('bedrock') ? 'bedrock' : 'fallback_block';

        let bedrockL = this.blocksGroup.create(this.offsetX - this.blockSize / 2, posY, bedrockTex) as Phaser.Physics.Arcade.Sprite;
        bedrockL.setDisplaySize(this.blockSize, this.blockSize).setDepth(10).refreshBody();

        let bedrockR = this.blocksGroup.create(this.offsetX + this.cols * this.blockSize + this.blockSize / 2, posY, bedrockTex) as Phaser.Physics.Arcade.Sprite;
        bedrockR.setDisplaySize(this.blockSize, this.blockSize).setDepth(10).refreshBody();

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
                    let r2 = Phaser.Math.Between(0, 100);
                    if (r2 < 2 + this.oreBonus * 0.5) type = BlockType.ORE_DIAMOND;
                    else if (r2 < 5 + this.oreBonus) type = BlockType.ORE_EMERALD;
                    else if (r2 < 10 + this.oreBonus * 1.5) type = BlockType.ORE_GOLD;
                    else if (r2 < 17 + this.oreBonus * 2) type = BlockType.ORE_COAL;
                    else if (r2 < 20 + this.oreBonus * 2) type = BlockType.TNT;
                    else if (r2 < 23 + this.oreBonus * 2) type = BlockType.BUFF_SIZE;
                    else if (r2 < 24 + this.oreBonus * 2) type = BlockType.WORKBENCH;
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
            let texKey = this.textures.exists(def.texture) ? def.texture : 'fallback_block';

            let sprite = this.blocksGroup.create(posX, posY, texKey) as Phaser.Physics.Arcade.Sprite;
            sprite.setDisplaySize(this.blockSize - 2, this.blockSize - 2).setDepth(10).refreshBody();

            let crackTex = this.textures.exists('crack_1') ? 'crack_1' : 'fallback_block';
            let crackSprite = this.add.sprite(posX, posY, crackTex)
                .setDisplaySize(this.blockSize - 2, this.blockSize - 2)
                .setAlpha(0)
                .setDepth(20);

            let depthMultiplier = 1.0 + (y * 0.02); 
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
        let newVx = Phaser.Math.Clamp(physicsBody.velocity.x * 0.4 + (diffX * 4), -300, 300);   
        
        if (Math.abs(diffX) < 5) newVx += Phaser.Math.Between(-40, 40);

        this.pickaxe.setVelocityX(newVx);
        this.pickaxe.setAngularVelocity(newVx * 2.5);
        
        this.safePlaySound('sfx_hit', { volume: 0.5 });

        let blockData = spriteObj.getData('blockRef') as BlockData;
        if (!blockData) return; 

        // Вычисление динамического урона
        let totalDamage = this.calculateDamage(this.currentPickaxeLevel);
        blockData.hp -= totalDamage;
        
        let depthPenalty = Math.floor(blockData.y / 20);
        this.pickaxeHp -= (1 + depthPenalty);

        this.tweens.add({ targets: [blockData.sprite, blockData.crackSprite], scale: 0.85, yoyo: true, duration: 60 });

        if (blockData.hp <= 0) {
            this.destroyBlock(blockData.x, blockData.y, false);
        } else {
            let ratio = blockData.hp / blockData.maxHp;
            if (this.textures.exists('crack_3') && ratio <= 0.33) blockData.crackSprite.setTexture('crack_3').setAlpha(1);
            else if (this.textures.exists('crack_2') && ratio <= 0.66) blockData.crackSprite.setTexture('crack_2').setAlpha(1);
            else if (this.textures.exists('crack_1') && ratio < 1.0) blockData.crackSprite.setTexture('crack_1').setAlpha(1);
        }

        this.updateUI();
        this.checkGameOver();
    }

    private destroyBlock(x: number, y: number, isExplosion: boolean) {
        if (y >= this.grid.length || y < 0 || x >= this.cols || x < 0) return;
        let block = this.grid[y][x];
        if (!block) return;

        this.grid[y][x] = null;
        
        this.currentDepth = Math.max(this.currentDepth, block.y + 1);

        this.score += Math.floor(block.score * this.scoreMultiplier);

        // Воспроизведение индивидуального звука для земли
        if (block.type === BlockType.DIRT) {
            this.safePlaySound('sfx_dirt', { volume: 0.7 });
        } else {
            this.safePlaySound('sfx_break', { volume: 0.7 });
        }

        if (!isExplosion) {
            if (block.type === BlockType.WORKBENCH) this.upgradePickaxe();
            else if (block.type === BlockType.BUFF_SIZE) this.applySizeBuff();
        }

        if (block.type === BlockType.TNT) {
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

    private updateUI() {
        let stat = PICKAXE_LEVELS[this.currentPickaxeLevel];
        let totalDamage = this.calculateDamage(this.currentPickaxeLevel);
        
        this.uiText.setText(
            `Глубина: ${this.currentDepth} (Рекорд: ${this.pData.maxDepth})\n` +
            `Множитель очков: x${this.scoreMultiplier.toFixed(2)}\n` +
            `Кирка: ${stat.name} (Lvl ${stat.level})\n` +
            `Урон: ${totalDamage}\n` +
            `Прочность: ${this.pickaxeHp}/${this.maxPickaxeHp}\n` +
            `Счет (к балансу): ${this.score}`
        );
    }

    private claimBalanceAndExit() {
        let physicsBody = this.pickaxe.body as Phaser.Physics.Arcade.Body;
        physicsBody.stop();
        physicsBody.enable = false;
        
        this.sound.stopAll();

        let currentState = SaveSystem.load();
        currentState.balance += this.score;
        currentState.maxDepth = Math.max(currentState.maxDepth, this.currentDepth);
        SaveSystem.save(currentState);

        this.scene.start('MainMenuScene');
    }

    private checkGameOver() {
        if (this.pickaxeHp <= 0) {
            let physicsBody = this.pickaxe.body as Phaser.Physics.Arcade.Body;
            physicsBody.stop();
            physicsBody.enable = false;
            
            this.sound.stopAll();
            this.safePlaySound('sfx_destroy', { volume: 1.0 });

            const gameOverContainer = this.add.container(800, this.cameras.main.scrollY + 450).setDepth(100);

            let goText = this.add.text(0, -60, `КИРКА СЛОМАЛАСЬ\nСЧЕТ: ${this.score}\n[ЗАВЕРШИТЬ ИГРУ]`, { 
                fontFamily: 'Courier', fontSize: '36px', color: '#ff2222', backgroundColor: '#000000ee',
                padding: { x: 20, y: 10 }, align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setStroke('#fff', 2);
            
            this.tweens.add({ targets: goText, scale: 1.05, yoyo: true, repeat: -1, duration: 800 });
            
            goText.on('pointerdown', () => {
                let currentState = SaveSystem.load();
                currentState.balance += this.score;
                currentState.maxDepth = Math.max(currentState.maxDepth, this.currentDepth);
                SaveSystem.save(currentState);
                this.scene.start('MainMenuScene');
            });

            gameOverContainer.add(goText);

            if (typeof (window as any).ysdk !== 'undefined' && (window as any).ysdk !== null) {
                let rewardBtn = this.add.rectangle(0, 60, 480, 60, 0x4CAF50)
                    .setInteractive({ useHandCursor: true }).setStrokeStyle(3, 0xffffff);
                
                let rewardText = this.add.text(0, 60, 'ВОССТАНОВИТЬ HP (РЕКЛАМА)', { 
                    fontFamily: 'Courier', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' 
                }).setOrigin(0.5);

                gameOverContainer.add([rewardBtn, rewardText]);

                rewardBtn.on('pointerdown', () => {
                    (window as any).ysdk.adv.showRewardedVideo({
                        callbacks: {
                            onOpen: () => {
                                this.sound.pauseAll();
                            },
                            onRewarded: () => {
                                this.pickaxeHp = this.maxPickaxeHp;
                            },
                            onClose: () => {
                                this.sound.resumeAll();
                                if (this.pickaxeHp > 0) {
                                    gameOverContainer.destroy();
                                    physicsBody.enable = true;
                                    this.pickaxe.setVelocityY(-250);
                                    this.updateUI();
                                }
                            },
                            onError: (e: any) => {
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