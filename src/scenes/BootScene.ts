import Phaser from 'phaser';

/**
 * 加载素材并注册动画。
 * - atlas      : Kenney CC0 地形/建筑（16×16，264 帧）
 * - hero       : MVP 主角 16×24，四方向各 3 帧（down0-2 / left3-5 / right6-8 / up9-11）
 * - npc        : MVP NPC 16×24，3 帧
 * - creatures  : MVP 神兽 64×64，2×2 共 4 帧
 * - ui         : MVP UI 图集（九宫格对话框、按钮、血条、摇杆）
 */
export default class BootScene extends Phaser.Scene {
  preload() {
    this.load.spritesheet('atlas', 'assets/atlas_shanhai.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('hero', 'assets/mvp/hero.png', { frameWidth: 16, frameHeight: 24 });
    this.load.spritesheet('npc', 'assets/mvp/npc.png', { frameWidth: 16, frameHeight: 24 });
    this.load.spritesheet('creatures', 'assets/mvp/creatures.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('ui', 'assets/mvp/ui.png');
  }

  create() {
    const dirs: { key: string; start: number }[] = [
      { key: 'down', start: 0 },
      { key: 'left', start: 3 },
      { key: 'right', start: 6 },
      { key: 'up', start: 9 },
    ];
    for (const d of dirs) {
      this.anims.create({
        key: `hero-${d.key}`,
        frames: this.anims.generateFrameNumbers('hero', { start: d.start, end: d.start + 2 }),
        frameRate: 7,
        repeat: -1,
      });
      this.anims.create({
        key: `hero-${d.key}-idle`,
        frames: [{ key: 'hero', frame: d.start + 1 }],
        frameRate: 1,
      });
    }

    this.scene.start('Overworld', { mapId: 'town' });
  }
}
