import Phaser from 'phaser';

// 调试：把运行期错误显示到页面（便于无头环境排查）
window.addEventListener('error', (e) => {
  const box = document.getElementById('errbox') ?? (() => {
    const d = document.createElement('div');
    d.id = 'errbox';
    d.style.cssText =
      'position:fixed;left:0;top:0;right:0;background:#a11;color:#fff;font:12px monospace;z-index:99999;padding:6px;white-space:pre-wrap';
    document.body.appendChild(d);
    return d;
  })();
  box.textContent += `\n[ERR] ${e.message} @ ${e.filename}:${e.lineno}`;
});
import BootScene from './scenes/BootScene';
import OverworldScene from './scenes/OverworldScene';
import UIScene from './scenes/UIScene';
import BattleScene from './scenes/BattleScene';
import DialogScene from './scenes/DialogScene';

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
  scene: [BootScene, OverworldScene, UIScene, BattleScene, DialogScene],
};

const game = new Phaser.Game(config);

// 调试句柄（自动化测试用：读取场景状态、模拟输入）
(window as unknown as { __game: Phaser.Game }).__game = game;
