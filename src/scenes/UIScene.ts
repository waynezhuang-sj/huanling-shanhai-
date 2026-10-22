import Phaser from 'phaser';

/** 独立 UI 场景：不受主相机缩放影响 */
export default class UIScene extends Phaser.Scene {
  private nameText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;

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
        color: '#e8eef5',
        backgroundColor: '#0d1117cc',
        padding: { x: 4, y: 2 },
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

  /** 靠近 NPC 时的提示（传空字符串隐藏） */
  setPrompt(text: string) {
    if (!this.promptText) {
      this.promptText = this.add
        .text(this.scale.width / 2, this.scale.height - 48, '', {
          fontSize: '12px',
          color: '#f0d9a8',
          backgroundColor: '#0d1117dd',
          padding: { x: 8, y: 4 },
          fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
        })
        .setOrigin(0.5, 0)
        .setDepth(11);
    }
    this.promptText.setText(text);
    this.promptText.setVisible(text.length > 0);
  }

  // ── 触屏摇杆可视化 ──
  private joyBase?: Phaser.GameObjects.Arc;
  private joyKnob?: Phaser.GameObjects.Arc;

  showJoystick(ox: number, oy: number, kx: number, ky: number) {
    if (!this.joyBase) {
      this.joyBase = this.add
        .circle(0, 0, 26, 0x000000, 0.3)
        .setStrokeStyle(2, 0xffffff, 0.35)
        .setDepth(20)
        .setVisible(false);
      this.joyKnob = this.add.circle(0, 0, 10, 0xffffff, 0.5).setDepth(21).setVisible(false);
    }
    this.joyBase.setPosition(ox, oy).setVisible(true);
    const dx = kx - ox;
    const dy = ky - oy;
    const len = Math.hypot(dx, dy) || 1;
    const s = Math.min(len, 26) / len;
    this.joyKnob!.setPosition(ox + dx * s, oy + dy * s).setVisible(true);
  }

  hideJoystick() {
    this.joyBase?.setVisible(false);
    this.joyKnob?.setVisible(false);
  }
}
