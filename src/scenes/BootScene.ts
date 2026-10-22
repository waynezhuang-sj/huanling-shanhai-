import Phaser from 'phaser';

/**
 * 只负责加载素材并跳到主场景。
 * 图集 atlas.png = Kenney Tiny Town(0-131) + Tiny Dungeon(132-263)，每格 16×16。
 * 授权：CC0 1.0（可商用，致谢 Kenney.nl）
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.spritesheet('atlas', 'assets/atlas.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // 加载进度（小游戏也给人一点反馈）
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const label = this.add
      .text(cx, cy + 24, '召唤中…', {
        fontSize: '12px',
        color: '#e8e0d0',
        fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
      })
      .setOrigin(0.5);
    this.load.on('progress', (v: number) => {
      label.setText(`召唤中… ${Math.round(v * 100)}%`);
    });
  }

  create() {
    this.scene.start('Overworld', { mapId: 'town' });
  }
}
