import Phaser from 'phaser';
import { createStoneButton, type StoneButtonHandle } from '../ui/StoneButton';
import { createStonePanel } from '../ui/StonePanel';
import { addCoinIcon } from '../ui/CoinIcon';
import { ACCENT, statTextStyle, styleTitleText } from '../ui/theme';
import { createUtilityButtons } from '../ui/UtilityButtons';
import { requestFullscreenForGameplayIfMobile } from '../yandex/PlatformUtils';
import { t, type TranslationKey } from '../i18n';
import { setGameplayWantsActive } from '../yandex/GameplayApi';
import { notifyGameReady } from '../yandex/sdk';
import { SaveSystem, type PlayerData } from '../yandex/CloudSave';

// Экономика прокачки. У hp/dmg/ore/mult единый темп роста цены 1.34:
// он чуть выше роста дохода за забег (~22% за уровень), поэтому время
// на каждый следующий уровень растёт равномерно, без резкой "стены".
//
// У кузниц (единственный апгрейд с потолком) цены заданы таблицей:
// к концу шкалы они растут резче, последний уровень — долгосрочная цель.
const FORGE_COSTS: number[] = [
    80, 120, 180, 270, 400, 600, 900, 1350, 2000, 3000, 4500, 7000, 11000, 20000, 50000
];
export const FORGE_MAX_LEVEL = FORGE_COSTS.length; // 15

interface UpgradeDef {
    base?: number;
    rate?: number;
    // Таблица цен вместо base/rate: costs[i] — цена перехода с уровня i на i+1.
    costs?: number[];
    // Максимальный уровень (в UI показывается MAX).
    maxLevel?: number;
}

export const UPGRADE_DEFS: Record<string, UpgradeDef> = {
    hp: { base: 80, rate: 1.34 },
    dmg: { base: 100, rate: 1.34 },
    ore: { base: 90, rate: 1.34 },
    mult: { base: 140, rate: 1.34 },
    forge: { costs: FORGE_COSTS, maxLevel: FORGE_MAX_LEVEL }
};

export function getUpgradeCost(id: string, level: number): number {
    const def = UPGRADE_DEFS[id];
    if (def.costs) {
        return def.costs[Math.min(level, def.costs.length - 1)];
    }
    return Math.floor(def.base! * Math.pow(def.rate!, level));
}

export function isUpgradeMaxed(id: string, level: number): boolean {
    const def = UPGRADE_DEFS[id];
    return def.maxLevel !== undefined && level >= def.maxLevel;
}

// Текущие уровни всех апгрейдов из сохранения (ключи как в UPGRADE_DEFS).
function getUpgradeLevels(data: PlayerData): Record<string, number> {
    return {
        hp: data.lvlHp,
        dmg: data.lvlDamage,
        ore: data.lvlOre,
        mult: data.lvlMult,
        forge: data.lvlBench
    };
}

// Есть ли апгрейд, который можно купить прямо сейчас.
function canAffordAnyUpgrade(data: PlayerData): boolean {
    const levels = getUpgradeLevels(data);
    return Object.keys(UPGRADE_DEFS).some((id) => {
        const level = levels[id] ?? 0;
        return !isUpgradeMaxed(id, level) && data.balance >= getUpgradeCost(id, level);
    });
}

export class MainMenuScene extends Phaser.Scene {
    private pData!: PlayerData;

    constructor() { super('MainMenuScene'); }

    preload() {
        this.load.image('bg_main', 'assets/bg_main.png');
        this.load.audio('bgm_menu', 'assets/audio/bg_main.mp3');
        this.load.audio('click-menu', 'assets/audio/click-menu.mp3');
    }

    create() {
        this.pData = SaveSystem.load();

        setGameplayWantsActive(false);

        // Музыка меню не перезапускается при переходах между экранами меню.
        // Проверяем getAll(), а не get(): get() может вернуть старый
        // остановленный экземпляр звука вместо играющего.
        const menuMusicPlaying = this.sound.getAll('bgm_menu').some(s => s.isPlaying);
        if (!menuMusicPlaying) {
            this.sound.stopAll();
            this.sound.removeByKey('bgm_menu');
            this.sound.play('bgm_menu', { loop: true, volume: 0.15 });
        }

        if (!this.textures.exists('fallback_bg_main')) {
            let g = this.make.graphics({ x: 0, y: 0 });
            g.fillStyle(0x1a1a2e, 1); g.fillRect(0, 0, 100, 100);
            g.generateTexture('fallback_bg_main', 100, 100);
            g.destroy();
        }
        let bgKey = this.textures.exists('bg_main') ? 'bg_main' : 'fallback_bg_main';
        this.add.tileSprite(800, 450, 1600, 900, bgKey);

        const title = this.add.text(800, 130, t('menu.title'), {
            fontFamily: 'Courier', fontSize: '68px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5);
        styleTitleText(title);

        this.buildStatsPanel(800, 290);

        createUtilityButtons(this, 1470, 45);

        createStoneButton(this, 800, 480, 420, 90, t('menu.play'), () => {
            // Должно вызываться прямо в обработчике клика, иначе браузер откажет.
            requestFullscreenForGameplayIfMobile();
            this.scene.start('GameScene', this.pData);
        }, '34px');

        createStoneButton(this, 800, 600, 420, 90, t('menu.upgrade'), () => {
            this.scene.start('UpgradeScene');
        }, '30px');

        createStoneButton(this, 800, 700, 420, 70, t('menu.leaders'), () => {
            this.scene.start('LeaderboardScene');
        }, '26px');

        if (canAffordAnyUpgrade(this.pData)) {
            const dot = this.add.circle(995, 563, 12, 0xff2222).setStrokeStyle(2, 0xffffff).setDepth(10);
            this.tweens.add({ targets: dot, scale: 1.2, yoyo: true, repeat: -1, duration: 500 });
        }

        // Меню загружено и интерактивно — сообщаем платформе (один раз за сеанс).
        notifyGameReady();
    }

    private buildStatsPanel(centerX: number, centerY: number) {
        const panelW = 620;
        const panelH = 176;

        createStonePanel(this, centerX, centerY, panelW, panelH);

        const iconX = centerX - panelW / 2 + 34;
        const textX = iconX + 22;
        const rows = [
            { y: centerY - 52, icon: true, text: t('menu.stats.balance', { value: this.pData.balance }) },
            { y: centerY, icon: false, text: t('menu.stats.maxDepth', { value: this.pData.maxDepth }) },
            { y: centerY + 52, icon: true, text: t('menu.stats.totalMined', { value: this.pData.totalCoinsMined }) }
        ];

        rows.forEach(row => {
            if (row.icon) addCoinIcon(this, iconX, row.y, 1.05);
            this.add.text(textX, row.y, row.text, statTextStyle('26px', '#ffd700')).setOrigin(0, 0.5);
        });
    }
}

export class UpgradeScene extends Phaser.Scene {
    private pData!: PlayerData;
    private balanceText!: Phaser.GameObjects.Text;
    // Нужны, чтобы после покупки пересчитать подсветку у всех строк.
    private upgradeHandles: { buyBtn: StoneButtonHandle; getCost: () => number | null; isMaxed: () => boolean }[] = [];

    constructor() { super('UpgradeScene'); }

    preload() {
        this.load.image('bg_upgrade', 'assets/bg_upgrade.png');
        this.load.audio('click-menu', 'assets/audio/click-menu.mp3');
    }

    create() {
        this.pData = SaveSystem.load();

        setGameplayWantsActive(false);

        // Сцена переиспользуется, сбрасываем хендлы с прошлого захода.
        this.upgradeHandles = [];

        if (!this.textures.exists('fallback_bg_upg')) {
            let g = this.make.graphics({ x: 0, y: 0 });
            g.fillStyle(0x2d1a2e, 1); g.fillRect(0, 0, 100, 100);
            g.generateTexture('fallback_bg_upg', 100, 100);
            g.destroy();
        }
        let bgKey = this.textures.exists('bg_upgrade') ? 'bg_upgrade' : 'fallback_bg_upg';
        this.add.tileSprite(800, 450, 1600, 900, bgKey);
        this.add.rectangle(800, 450, 1600, 900, 0x000000, 0.2);

        createUtilityButtons(this, 1470, 45);

        const title = this.add.text(800, 70, t('upgrade.title'), {
            fontFamily: 'Courier', fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5);
        styleTitleText(title);

        const balancePanelW = 420;
        createStonePanel(this, 800, 140, balancePanelW, 66);
        addCoinIcon(this, 800 - balancePanelW / 2 + 30, 140, 1.1);
        this.balanceText = this.add.text(
            800 - balancePanelW / 2 + 54, 140, t('upgrade.balance', { value: this.pData.balance }), statTextStyle('24px', '#ffd700')
        ).setOrigin(0, 0.5);

        const upgrades = [
            { id: 'hp', nameKey: 'upgrade.hp.name' as const, getLvl: () => this.pData.lvlHp, setLvl: (v: number) => { this.pData.lvlHp = v; }, y: 235, color: '#4CAF50' },
            { id: 'dmg', nameKey: 'upgrade.dmg.name' as const, getLvl: () => this.pData.lvlDamage, setLvl: (v: number) => { this.pData.lvlDamage = v; }, y: 340, color: '#FF5722' },
            { id: 'mult', nameKey: 'upgrade.mult.name' as const, getLvl: () => this.pData.lvlMult, setLvl: (v: number) => { this.pData.lvlMult = v; }, y: 445, color: '#2196F3' },
            { id: 'ore', nameKey: 'upgrade.ore.name' as const, getLvl: () => this.pData.lvlOre, setLvl: (v: number) => { this.pData.lvlOre = v; }, y: 550, color: '#9C27B0' },
            // lvlBench — старое имя поля сохранения, не переименовано ради совместимости.
            { id: 'forge', nameKey: 'upgrade.forge.name' as const, getLvl: () => this.pData.lvlBench, setLvl: (v: number) => { this.pData.lvlBench = v; }, y: 655, color: '#FFC107' }
        ];

        upgrades.forEach(u => this.createUpgradeUI(u));

        createStoneButton(this, 800, 800, 320, 66, t('common.backToMenu'), () => this.scene.start('MainMenuScene'), '22px');

        this.refreshAffordability();
    }

    private createUpgradeUI(u: { id: string; nameKey: TranslationKey; getLvl: () => number; setLvl: (v: number) => void; y: number; color: string }) {
        let currentLvl = u.getLvl();
        let maxed = isUpgradeMaxed(u.id, currentLvl);
        let cost: number | null = maxed ? null : getUpgradeCost(u.id, currentLvl);

        const rowTitle = () => t('upgrade.rowTitle', { name: t(u.nameKey), level: currentLvl });

        createStonePanel(this, 800, u.y, 800, 90);
        const titleText = this.add.text(450, u.y, rowTitle(), statTextStyle('22px', '#ffffff', 4)).setOrigin(0, 0.5);

        const buyBtn = createStoneButton(this, 1050, u.y, 260, 66, maxed ? t('common.max') : t('upgrade.buy', { cost: cost as number }), () => {
            if (maxed || cost === null) return;

            if (this.pData.balance >= cost) {
                this.pData.balance -= cost;
                u.setLvl(u.getLvl() + 1);
                SaveSystem.save(this.pData);

                this.balanceText.setText(t('upgrade.balance', { value: this.pData.balance }));
                currentLvl = u.getLvl();
                titleText.setText(rowTitle());

                maxed = isUpgradeMaxed(u.id, currentLvl);
                if (maxed) {
                    cost = null;
                    buyBtn.setLabel(t('common.max'));
                    buyBtn.setEnabled(false);
                } else {
                    cost = getUpgradeCost(u.id, currentLvl);
                    buyBtn.setLabel(t('upgrade.buy', { cost }));
                }

                this.refreshAffordability();
            } else {
                this.cameras.main.shake(150, 0.005);
            }
        }, '18px', { accentColor: ACCENT.gold });

        if (maxed) {
            buyBtn.setLabel(t('common.max'));
            buyBtn.setEnabled(false);
        }

        this.upgradeHandles.push({ buyBtn, getCost: () => cost, isMaxed: () => maxed });
    }

    // Ярко — апгрейд по карману, тускло — нет. Кнопки MAX не трогаем.
    private refreshAffordability() {
        this.upgradeHandles.forEach(h => {
            if (h.isMaxed()) return;
            const cost = h.getCost();
            if (cost === null) return;
            const canAfford = this.pData.balance >= cost;
            h.buyBtn.setAccentColor(canAfford ? ACCENT.goldBright : ACCENT.goldDim);
        });
    }
}
