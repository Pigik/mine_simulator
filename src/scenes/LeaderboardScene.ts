import Phaser from 'phaser';
import { createStoneButton } from '../ui/StoneButton';
import { createStonePanel } from '../ui/StonePanel';
import { addCoinIcon } from '../ui/CoinIcon';
import { statTextStyle, secondaryTextStyle, styleTitleText } from '../ui/theme';
import { fetchLeaderboard, type LeaderboardRow } from '../yandex/Leaderboard';
import { createUtilityButtons } from '../ui/UtilityButtons';
import { t } from '../i18n';
import { setGameplayWantsActive } from '../yandex/GameplayApi';

// Таблица лидеров Яндекс Игр. Сортировка всегда только по глубине (это то,
// что мы кладём в score лидерборда) — суммарное количество добытых монет
// хранится в extraData и просто выводится рядом справочно, в сортировке не
// участвует (см. src/yandex/Leaderboard.ts).
export class LeaderboardScene extends Phaser.Scene {
    private statusText!: Phaser.GameObjects.Text;

    constructor() { super('LeaderboardScene'); }

    preload() {
        this.load.image('bg_main', 'assets/bg_main.png');
        this.load.audio('click-menu', 'assets/audio/click-menu.mp3');
    }

    create() {
        // Требование Яндекс Игр (см. GameplayApi.ts): таблица лидеров —
        // тоже не активный геймплей.
        setGameplayWantsActive(false);

        if (!this.textures.exists('fallback_bg_main')) {
            let g = this.make.graphics({ x: 0, y: 0 });
            g.fillStyle(0x1a1a2e, 1); g.fillRect(0, 0, 100, 100);
            g.generateTexture('fallback_bg_main', 100, 100);
            g.destroy();
        }
        if (!this.textures.exists('fallback_avatar')) {
            let g = this.make.graphics({ x: 0, y: 0 });
            g.fillStyle(0x555555, 1); g.fillCircle(32, 32, 32);
            g.fillStyle(0x888888, 1); g.fillCircle(32, 24, 14);
            g.fillEllipse(32, 52, 32, 22);
            g.generateTexture('fallback_avatar', 64, 64);
            g.destroy();
        }

        let bgKey = this.textures.exists('bg_main') ? 'bg_main' : 'fallback_bg_main';
        this.add.tileSprite(800, 450, 1600, 900, bgKey).setAlpha(0.6);
        this.add.rectangle(800, 450, 1600, 900, 0x0a0a12, 0.35);

        // Единая каменная подложка под весь контент таблицы — вместо
        // отдельных полупрозрачных серых плашек под каждым элементом.
        createStonePanel(this, 800, 460, 1060, 660);

        const title = this.add.text(800, 60, t('leaderboard.title'), {
            fontFamily: 'Courier', fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5);
        styleTitleText(title);

        this.add.text(800, 105, t('leaderboard.subtitle'), secondaryTextStyle('20px')).setOrigin(0.5);

        createUtilityButtons(this, 1470, 45);

        this.statusText = this.add.text(800, 450, t('leaderboard.loading'), {
            fontFamily: 'Courier', fontSize: '28px', color: '#cccccc', align: 'center'
        }).setOrigin(0.5);

        createStoneButton(this, 800, 855, 320, 66, t('common.backToMenu'), () => this.scene.start('MainMenuScene'), '22px');

        this.loadLeaderboard();
    }

    private async loadLeaderboard() {
        const result = await fetchLeaderboard(10);

        if (!result.available) {
            this.statusText.setText(t('leaderboard.unavailable'));
            return;
        }

        if (result.rows.length === 0) {
            this.statusText.setText(
                result.errorReason === 'fetch_failed'
                    ? t('leaderboard.fetchFailed')
                    : t('leaderboard.empty')
            );
            return;
        }

        this.statusText.setVisible(false);
        this.renderRows(result.rows, result.currentUserRank);
    }

    private renderRows(rows: LeaderboardRow[], currentUserRank: number | null) {
        const top3 = rows.slice(0, 3);
        const rest = rows.slice(3);

        this.buildPodium(top3);
        this.buildList(rest, 540);

        if (currentUserRank !== null && !rows.some(r => r.isCurrentUser)) {
            this.add.text(800, 785, t('leaderboard.yourRank', { rank: currentUserRank }), statTextStyle('22px', '#ffffa0')).setOrigin(0.5);
        }

        this.loadAvatars(top3);
    }

    // Пьедестал для топ-3: 1 место — по центру и выше всех, 2 — слева, 3 — справа,
    // с медальным цветом и подписью глубины/монет под каждым. Блоки теперь
    // рисуются той же "каменной" техникой, что и кнопки/панели (с
    // соответствующим оттенком — золото/серебро/бронза), а не плоской
    // цветной заливкой.
    private buildPodium(top3: LeaderboardRow[]) {
        type Slot = { x: number; blockH: number; color: number; medal: string; labelSize: string };
        const slots: Record<number, Slot> = {
            1: { x: 800, blockH: 150, color: 0xffd700, medal: '🥇', labelSize: '26px' },
            2: { x: 520, blockH: 105, color: 0xc0c0c0, medal: '🥈', labelSize: '22px' },
            3: { x: 1080, blockH: 75, color: 0xcd7f32, medal: '🥉', labelSize: '22px' }
        };

        const baseY = 430;

        top3.forEach(row => {
            const slot = slots[row.rank];
            if (!slot) return;

            const avatarY = baseY - slot.blockH - 55;

            this.add.circle(slot.x, avatarY, 38, slot.color).setStrokeStyle(3, 0x000000);
            const avatar = this.add.image(slot.x, avatarY, 'fallback_avatar').setDisplaySize(64, 64);
            avatar.setName(this.avatarKey(row.rank));
            const mask = this.make.graphics({ x: 0, y: 0 }).fillCircle(slot.x, avatarY, 32).createGeometryMask();
            avatar.setMask(mask);

            this.add.text(slot.x, avatarY - 55, slot.medal, { fontSize: '30px' }).setOrigin(0.5);

            this.add.text(slot.x, avatarY + 48, row.name, statTextStyle(slot.labelSize, '#ffffff')).setOrigin(0.5);

            // Подиумный блок — та же каменная плашка, тонированная в цвет медали.
            const blockY = baseY - slot.blockH / 2 + 40;
            createStonePanel(this, slot.x, blockY, 180, slot.blockH, { accentColor: slot.color });

            this.add.text(slot.x, blockY - 16, t('leaderboard.podiumDepth', { value: row.depth }), statTextStyle('16px', '#ffffff', 3)).setOrigin(0.5);

            addCoinIcon(this, slot.x - 34, blockY + 14, 0.6);
            this.add.text(slot.x - 20, blockY + 14, `${row.totalCoins}`, statTextStyle('16px', '#ffffff', 3)).setOrigin(0, 0.5);
        });
    }

    // Простой построчный список для мест с 4-го и ниже.
    private buildList(rows: LeaderboardRow[], startY: number) {
        if (rows.length === 0) return;

        const rowH = 34;
        this.add.text(300, startY - 24, t('leaderboard.col.rank'), secondaryTextStyle('16px'));
        this.add.text(420, startY - 24, t('leaderboard.col.player'), secondaryTextStyle('16px'));
        this.add.text(950, startY - 24, t('leaderboard.col.depth'), secondaryTextStyle('16px'));
        this.add.text(1150, startY - 24, t('leaderboard.col.coins'), secondaryTextStyle('16px'));

        rows.forEach((row, i) => {
            const y = startY + i * rowH;

            if (i % 2 === 0) {
                this.add.rectangle(800, y, 1000, rowH - 2, 0xffffff, 0.05);
            }
            if (row.isCurrentUser) {
                this.add.rectangle(800, y, 1000, rowH - 2, 0xffffa0, 0.14).setStrokeStyle(1, 0xffffa0);
            }

            const textStyle = statTextStyle('18px', '#eeeeee', 3);
            this.add.text(300, y, `#${row.rank}`, textStyle).setOrigin(0, 0.5);
            this.add.text(420, y, row.name, textStyle).setOrigin(0, 0.5);
            this.add.text(950, y, String(row.depth), textStyle).setOrigin(0, 0.5);
            addCoinIcon(this, 1150, y, 0.55);
            this.add.text(1168, y, String(row.totalCoins), textStyle).setOrigin(0, 0.5);
        });
    }

    private avatarKey(rank: number): string {
        return `avatar_lb_${rank}`;
    }

    // Аватарки игроков — это внешние URL с серверов Яндекса, их нельзя
    // подгрузить заранее в preload(). Грузим их точечно после получения
    // списка лидеров; если какая-то не загрузится (нет сети, CORS и т.п.),
    // на месте так и останется нейтральная заглушка fallback_avatar —
    // это не критично и не должно ломать экран.
    private loadAvatars(top3: LeaderboardRow[]) {
        const toLoad = top3.filter(r => r.avatarUrl && !this.textures.exists(this.avatarKey(r.rank)));
        if (toLoad.length === 0) return;

        toLoad.forEach(r => this.load.image(this.avatarKey(r.rank), r.avatarUrl as string));

        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
            toLoad.forEach(r => {
                if (this.textures.exists(this.avatarKey(r.rank))) {
                    const img = this.children.getByName(this.avatarKey(r.rank)) as Phaser.GameObjects.Image;
                    if (img) img.setTexture(this.avatarKey(r.rank)).setDisplaySize(64, 64);
                }
            });
        });

        this.load.start();
    }
}
