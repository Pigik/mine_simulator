import Phaser from 'phaser';
import { createStoneButton, type StoneButtonHandle } from '../ui/StoneButton';
import { createStonePanel } from '../ui/StonePanel';
import { addCoinIcon } from '../ui/CoinIcon';
import { ACCENT, statTextStyle, styleTitleText } from '../ui/theme';
import { createUtilityButtons } from '../ui/UtilityButtons';
import { requestFullscreenForGameplayIfMobile } from '../yandex/PlatformUtils';
import { t, type TranslationKey } from '../i18n';
import { setGameplayWantsActive } from '../yandex/GameplayApi';
// PlayerData/SaveSystem переехали в yandex/CloudSave.ts — там же теперь
// живёт сохранение через SDK Яндекс Игр (player.getData/setData), а не
// только в localStorage. Реэкспортируем их отсюда не нужно: GameScene.ts
// импортирует их напрямую из CloudSave.
import { SaveSystem, type PlayerData } from '../yandex/CloudSave';

// Экономика прокачки — пересчитана по симуляции реальных формул игры (шансы
// руд/кузницы, урон/HP, вехи), не на глаз. Раньше у hp/dmg/ore/mult были
// РАЗНЫЕ темпы роста цены (1.35/1.45/1.40/1.55): при равномерной прокачке
// всех четырёх это давало не плавный, а УСКОРЯЮЩИЙСЯ рост времени на
// накопление — цена множителя очков (rate 1.55) с какого-то момента росла
// заметно быстрее, чем росли доходы игрока, и разрыв между "сколько нужно"
// и "сколько зарабатываешь" не просто увеличивался, а увеличивался со
// всё возрастающей скоростью (на 15 уровне это уже +1.2 забега за один
// уровень прокачки, хотя на 5 уровне было всего +0.1) — ощущалось как
// внезапная "стена" посреди игры, а не постепенное усложнение.
//
// Симуляция показала: средний доход за забег при равномерной прокачке
// растёт примерно на 22-23% за уровень (пока не упирается в потолки вроде
// макс. уровня кирки и предела шанса руд — это отдельный, ожидаемый
// "поздний" replay-wall). Чтобы время на накопление росло РАВНОМЕРНО —
// то есть каждый уровень требовал в одно и то же число раз больше забегов,
// чем предыдущий, а не по нарастающей — темп роста цены должен превышать
// темп роста дохода на постоянный (небольшой) множитель. Отсюда единый
// rate = 1.34 для всех четырёх — даёт стабильный рост "время на уровень"
// примерно на 5-15% за уровень на всём протяжении прокачки (не 2%, потом
// 100%). Базовые цены (base) не трогали — они и раньше задавали разумную
// относительную "стоимость входа", это сохраняет прежнее ощущение первых
// покупок.
//
// У "частоты кузниц" — единственного апгрейда с потолком уровня — цена
// задана явной таблицей, а не формулой base*rate^level: рост не строго
// геометрический (constant ratio), а ускоряющийся — ближе к концу шкалы
// цена скачет заметно резче, чем в начале, и последний, 15-й уровень стоит
// ощутимо больше, чем "просто следующий шаг" (50 000 — самый дорогой
// апгрейд в игре, настоящая долгосрочная цель).
const FORGE_COSTS: number[] = [
    80, 120, 180, 270, 400, 600, 900, 1350, 2000, 3000, 4500, 7000, 11000, 20000, 50000
];
export const FORGE_MAX_LEVEL = FORGE_COSTS.length; // 15

interface UpgradeDef {
    base?: number;
    rate?: number;
    // Явная таблица цен по уровням — если задана, используется вместо
    // base/rate. costs[i] — цена покупки уровня (i+1)-го, т.е. перехода
    // с уровня i на уровень i+1.
    costs?: number[];
    // Если задан — после этого уровня апгрейд больше нельзя купить
    // (в UI на месте цены показывается "MAX").
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

// Апгрейд считается "выкачанным до предела", если у него задан maxLevel и
// текущий уровень его достиг — на UpgradeScene вместо цены в этом случае
// показывается "MAX", а кнопка покупки отключается.
export function isUpgradeMaxed(id: string, level: number): boolean {
    const def = UPGRADE_DEFS[id];
    return def.maxLevel !== undefined && level >= def.maxLevel;
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

        // Требование Яндекс Игр (см. GameplayApi.ts): в главном меню нет
        // активного геймплея.
        setGameplayWantsActive(false);

        // Фоновая музыка меню не должна перезапускаться при переходах между
        // вкладками меню (прокачка/лидеры и обратно) — трек общий для всех
        // этих сцен и просто продолжает играть. ВАЖНО: каждый sound.play()
        // создаёт НОВЫЙ объект звука, а старые остановленные объекты сами
        // из менеджера не удаляются — поэтому sound.get() (который отдаёт
        // самый первый добавленный инстанс с этим ключом) после пары
        // заходов в игру и обратно находит старый мёртвый инстанс вместо
        // реально играющего, и ошибочно считает, что музыка не играет.
        // Поэтому проверяем через getAll(), не играет ли уже ХОТЬ ОДИН
        // инстанс bgm_menu. Перезапуск (с чисткой мёртвых инстансов) нужен
        // только когда музыка правда не играет: при первом входе в меню и
        // при выходе из игры (там GameScene сама останавливает звук через
        // sound.stopAll() перед scene.start('MainMenuScene')).
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
            // Требование Яндекс Игр для мобильных устройств (см.
            // PlatformUtils.ts): игра должна быть в полноэкранном режиме
            // во время геймплея. Запрос делается прямо в обработчике
            // клика — это пользовательский жест, без которого браузер
            // молча откажет во включении полноэкранного режима.
            requestFullscreenForGameplayIfMobile();
            this.scene.start('GameScene', this.pData);
        }, '34px');

        createStoneButton(this, 800, 600, 420, 90, t('menu.upgrade'), () => {
            this.scene.start('UpgradeScene');
        }, '30px');

        createStoneButton(this, 800, 700, 420, 70, t('menu.leaders'), () => {
            this.scene.start('LeaderboardScene');
        }, '26px');

        const canUpgrade = this.pData.balance >= getUpgradeCost('hp', this.pData.lvlHp) ||
                           this.pData.balance >= getUpgradeCost('mult', this.pData.lvlMult) ||
                           this.pData.balance >= getUpgradeCost('ore', this.pData.lvlOre) ||
                           this.pData.balance >= getUpgradeCost('dmg', this.pData.lvlDamage);

        if (canUpgrade) {
            const dot = this.add.circle(995, 563, 12, 0xff2222).setStrokeStyle(2, 0xffffff).setDepth(10);
            this.tweens.add({ targets: dot, scale: 1.2, yoyo: true, repeat: -1, duration: 500 });
        }
    }

    // Каменная панель со статами вместо голого текста поверх фона:
    // баланс и всего добыто — с иконкой монеты вместо эмодзи 💰, рекорд
    // глубины — без иконки, но выровнен по той же левой границе. Все
    // цифры жирные с толстой обводкой, чтобы не терялись на фоне.
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
    // Кнопки покупки апгрейдов вместе с геттером их текущей цены — нужно,
    // чтобы после любой покупки пересчитать подсветку СРАЗУ у всех строк
    // (баланс уменьшился, значит какие-то ещё апгрейды могли перестать
    // быть по карману), а не только у той, которую купили. getCost вернёт
    // null, а isMaxed — true, когда апгрейд уже выкачан до предела (см.
    // "частота верстаков" — единственный с потолком уровня).
    private upgradeHandles: { buyBtn: StoneButtonHandle; getCost: () => number | null; isMaxed: () => boolean }[] = [];

    constructor() { super('UpgradeScene'); }

    preload() {
        this.load.image('bg_upgrade', 'assets/bg_upgrade.png');
        this.load.audio('click-menu', 'assets/audio/click-menu.mp3');
    }

    create() {
        this.pData = SaveSystem.load();

        // Требование Яндекс Игр (см. GameplayApi.ts): экран прокачки —
        // тоже не активный геймплей.
        setGameplayWantsActive(false);

        // Сцена переиспользуется при каждом возврате в "Прокачку" — без
        // сброса сюда бы копились хендлы кнопок с прошлых заходов,
        // указывающие на уже уничтоженные объекты.
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
            // ПРИМЕЧАНИЕ: поле в сохранении (pData.lvlBench) не переименовано
            // вместе с апгрейдом — это persisted-поле (см. PlayerData в
            // yandex/CloudSave.ts), и переименование здесь молча обнулило бы
            // уровень кузницы у всех, кто уже играл (старое сохранение просто
            // не содержит нового ключа). "bench" остался только как имя этого
            // внутреннего поля, наружу (тексты, id апгрейда) игрок его больше
            // не видит.
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
                    // Апгрейд выкачан до предела — дальше покупать нечего,
                    // вместо цены показываем MAX и отключаем кнопку.
                    cost = null;
                    buyBtn.setLabel(t('common.max'));
                    buyBtn.setEnabled(false);
                } else {
                    cost = getUpgradeCost(u.id, currentLvl);
                    buyBtn.setLabel(t('upgrade.buy', { cost }));
                }

                // Покупка меняет баланс — пересчитываем подсветку у ВСЕХ
                // строк, а не только у этой (соседние апгрейды могли стать
                // недоступны).
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

    // Апгрейды, на которые хватает монет прямо сейчас, подсвечиваются более
    // ярким жёлтым; те, на которые не хватает — приглушённым, тусклым
    // золотым (кнопка при этом остаётся кликабельной — клик по ней всё
    // так же трясёт камеру в знак "не хватает денег"). Уже выкачанные до
    // предела (MAX) апгрейды не трогаем — они уже в отключённом виде.
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
