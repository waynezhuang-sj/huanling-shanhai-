import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import OverworldScene from './scenes/OverworldScene';
import UIScene from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 480,
  height: 320,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, OverworldScene, UIScene],
};

new Phaser.Game(config);
