import Phaser from 'phaser';

/** 独立 UI 场景：不受主相机缩放影响 */
export default class UIScene extends Phaser.Scene {
  private nameText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UI', active: false });
  }

  create() {
    this.nameText = this.add
      .text(8, 8, '', {
        fontSize: '13px',
        color: '#e8e0d0',
        fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
        backgroundColor: '#0d1117cc',
        padding: { x: 6, y: 3 },
      })
      .setDepth(10);

    this.hintText = this.add
      .text(8, this.scale.height - 20, '方向键 / WASD 移动　·　手机按住屏幕拖动　·　走到地图边缘切换', {
        fontSize: '10px',
        color: '#9aa5b1',
        fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
      })
      .setDepth(10);

    this.tweens.add({
      targets: this.hintText,
      alpha: 0.3,
      duration: 1400,
      yoyo: true,
      repeat: -1,
    });
  }

  setMapName(name: string) {
    this.nameText.setText(name);
  }
}
