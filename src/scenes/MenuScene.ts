import Phaser from 'phaser';

export interface PlayerData {
    balance: number;
    lvlHp: number;
    lvlMult: number;
    lvlOre: number;
    lvlDamage: number;
    maxDepth: number;
}

export const SaveSystem = {
    load(): PlayerData {
        const data = localStorage.getItem('miner_save');
        if (data) {
            let parsed = JSON.parse(data);
            if (parsed.lvlDamage === undefined) parsed.lvlDamage = 0;
            if (parsed.maxDepth === undefined) parsed.maxDepth = 0;
            return parsed;
        }
        return { balance: 0, lvlHp: 0, lvlMult: 0, lvlOre: 0, lvlDamage: 0, maxDepth: 0 };
    },
    save(data: PlayerData) {
        localStorage.setItem('miner_save', JSON.stringify(data));
    }
};

export function getUpgradeCost(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level));
}

export class MainMenuScene extends Phaser.Scene {
    private pData!: PlayerData;

    constructor() { super('MainMenuScene'); }

    preload() {
        this.load.image('bg_main', 'src/assets/bg_main.png');
        this.load.audio('bgm_menu', 'src/assets/audio/bg_main.mp3');
    }

    create() {
        this.pData = SaveSystem.load();

        this.sound.stopAll();
        this.sound.play('bgm_menu', { loop: true, volume: 0.15 });

        if (!this.textures.exists('fallback_bg_main')) {
            let g = this.make.graphics({ x: 0, y: 0 }); 
            g.fillStyle(0x1a1a2e, 1); g.fillRect(0, 0, 100, 100);
            g.generateTexture('fallback_bg_main', 100, 100);
            g.destroy();
        }
        let bgKey = this.textures.exists('bg_main') ? 'bg_main' : 'fallback_bg_main';
        this.add.tileSprite(800, 450, 1600, 900, bgKey);

        this.add.text(800, 200, 'СИМУЛЯТОР ШАХТЫ', { 
            fontFamily: 'Courier', fontSize: '64px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(800, 300, `БАЛАНС: ${this.pData.balance} 💰\nРЕКОРД ГЛУБИНЫ: ${this.pData.maxDepth}`, { 
            fontFamily: 'Courier', fontSize: '36px', color: '#ffd700',
            stroke: '#000000', strokeThickness: 4, align: 'center'
        }).setOrigin(0.5);

        const playBtn = this.add.rectangle(800, 500, 400, 80, 0x4CAF50)
            .setInteractive({ useHandCursor: true }).setStrokeStyle(4, 0xffffff);
        this.add.text(800, 500, 'ИГРАТЬ', { fontFamily: 'Courier', fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        
        playBtn.on('pointerdown', () => {
            this.scene.start('GameScene', this.pData);
        });
        this.tweens.add({ targets: playBtn, scale: 1.05, yoyo: true, repeat: -1, duration: 1200 });

        const upgradeBtn = this.add.rectangle(800, 620, 400, 80, 0x2196F3)
            .setInteractive({ useHandCursor: true }).setStrokeStyle(4, 0xffffff);
        this.add.text(800, 620, 'ПРОКАЧКА', { fontFamily: 'Courier', fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        upgradeBtn.on('pointerdown', () => this.scene.start('UpgradeScene'));

        const canUpgrade = this.pData.balance >= getUpgradeCost(this.pData.lvlHp) || 
                           this.pData.balance >= getUpgradeCost(this.pData.lvlMult) || 
                           this.pData.balance >= getUpgradeCost(this.pData.lvlOre) ||
                           this.pData.balance >= getUpgradeCost(this.pData.lvlDamage);
        
        if (canUpgrade) {
            const dot = this.add.circle(980, 595, 12, 0xff2222).setStrokeStyle(2, 0xffffff);
            this.tweens.add({ targets: dot, scale: 1.2, yoyo: true, repeat: -1, duration: 500 });
        }
    }
}

export class UpgradeScene extends Phaser.Scene {
    private pData!: PlayerData;
    private balanceText!: Phaser.GameObjects.Text;

    constructor() { super('UpgradeScene'); }

    preload() {
        this.load.image('bg_upgrade', 'src/assets/bg_upgrade.png');
    }

    create() {
        this.pData = SaveSystem.load();

        if (!this.textures.exists('fallback_bg_upg')) {
            let g = this.make.graphics({ x: 0, y: 0 }); 
            g.fillStyle(0x2d1a2e, 1); g.fillRect(0, 0, 100, 100);
            g.generateTexture('fallback_bg_upg', 100, 100);
            g.destroy();
        }
        let bgKey = this.textures.exists('bg_upgrade') ? 'bg_upgrade' : 'fallback_bg_upg';
        this.add.tileSprite(800, 450, 1600, 900, bgKey);

        this.add.text(800, 80, 'ШАХТА: УЛУЧШЕНИЯ', { 
            fontFamily: 'Courier', fontSize: '48px', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 
        }).setOrigin(0.5);

        this.balanceText = this.add.text(800, 150, `БАЛАНС: ${this.pData.balance} 💰`, { 
            fontFamily: 'Courier', fontSize: '32px', color: '#ffd700', stroke: '#000', strokeThickness: 4 
        }).setOrigin(0.5);

        const upgrades = [
            { id: 'hp', name: 'Базовое HP (+5 HP)', getLvl: () => this.pData.lvlHp, setLvl: (v: number) => { this.pData.lvlHp = v; }, y: 260, color: '#4CAF50' },
            { id: 'dmg', name: 'Базовый урон (+2)', getLvl: () => this.pData.lvlDamage, setLvl: (v: number) => { this.pData.lvlDamage = v; }, y: 380, color: '#FF5722' },
            { id: 'mult', name: 'Множитель очков (+5%)', getLvl: () => this.pData.lvlMult, setLvl: (v: number) => { this.pData.lvlMult = v; }, y: 500, color: '#2196F3' },
            { id: 'ore', name: 'Частота спавна руд', getLvl: () => this.pData.lvlOre, setLvl: (v: number) => { this.pData.lvlOre = v; }, y: 620, color: '#9C27B0' }
        ];

        upgrades.forEach(u => this.createUpgradeUI(u));

        const backBtn = this.add.rectangle(800, 780, 300, 60, 0x555555)
            .setInteractive({ useHandCursor: true }).setStrokeStyle(3, 0xffffff);
        this.add.text(800, 780, 'НАЗАД В МЕНЮ', { fontFamily: 'Courier', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        backBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));
    }

    private createUpgradeUI(u: any) {
        let currentLvl = u.getLvl();
        let cost = getUpgradeCost(currentLvl);

        const bg = this.add.rectangle(800, u.y, 800, 90, 0x222222, 0.8).setStrokeStyle(2, 0x555555);
        const titleText = this.add.text(450, u.y, `${u.name} (Ур. ${currentLvl})`, { fontFamily: 'Courier', fontSize: '24px', color: '#ffffff' }).setOrigin(0, 0.5);
        
        const btn = this.add.rectangle(1050, u.y, 250, 60, Phaser.Display.Color.HexStringToColor(u.color).color).setInteractive({ useHandCursor: true });
        const btnText = this.add.text(1050, u.y, `Купить: ${cost}`, { fontFamily: 'Courier', fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        btn.on('pointerdown', () => {
            if (this.pData.balance >= cost) {
                this.pData.balance -= cost;
                u.setLvl(u.getLvl() + 1);
                SaveSystem.save(this.pData);
                
                this.balanceText.setText(`БАЛАНС: ${this.pData.balance} 💰`);
                currentLvl = u.getLvl();
                cost = getUpgradeCost(currentLvl);
                titleText.setText(`${u.name} (Ур. ${currentLvl})`);
                btnText.setText(`Купить: ${cost}`);
                this.cameras.main.flash(150, 255, 255, 255);
            } else {
                this.cameras.main.shake(150, 0.005);
            }
        });
    }
}