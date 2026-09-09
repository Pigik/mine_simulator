import Phaser from 'phaser';
import './style.css';
import { MainMenuScene, UpgradeScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1600,
    height: 900,
    parent: 'app',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 600, x: 0 }, 
            debug: false 
        }
    },
    // Регистрация новых сцен $\mathcal{O}(1)$
    scene: [MainMenuScene, UpgradeScene, GameScene]
};

new Phaser.Game(config);