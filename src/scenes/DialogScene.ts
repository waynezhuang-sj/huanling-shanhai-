import Phaser from 'phaser';
import { SHOP_ITEMS, type NpcDef } from '../data/npcs';
import { addItem, countItem, healAll, wallet, party } from '../state/party';

const W = 480;
const H = 320;
const BOX_Y = 198;
const BOX_H = 114;

export default class DialogScene extends Phaser.Scene {
  private npc!: NpcDef;
  private lines: string[] = [];
  private idx = 0;
  private typing = false;
  private full = '';
  private typeTimer?: Phaser.Time.TimerEvent;

  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Text;
  private shopBox!: Phaser.GameObjects.Container;
  private coinText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'Dialog' });
  }

  init(data: { npc: NpcDef }) {
    this.npc = data.npc;
    this.lines = [...data.npc.lines];
    this.idx = 0;
    this.typing = false;
  }

  create() {
    // 半透明遮罩，压暗地图
    this.add.rectangle(0, 0, W, H, 0x000000, 0.25).setOrigin(0);

    // 名字牌
    this.add.rectangle(14, BOX_Y - 22, 140, 22, 0x0d1117).setOrigin(0).setStrokeStyle(1, 0x3a4a5c);
    this.nameText = this.add.text(22, BOX_Y - 19, this.npc.name, {
      fontSize: '12px',
      color: '#f0d9a8',
      fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
    });

    // 对话框
    this.add
      .rectangle(8, BOX_Y, W - 16, BOX_H, 0x0d1117)
      .setOrigin(0)
      .setStrokeStyle(2, 0x3a4a5c);

    this.bodyText = this.add.text(22, BOX_Y + 14, '', {
      fontSize: '13px',
      color: '#e8eef5',
      fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
      wordWrap: { width: W - 60 },
      lineSpacing: 6,
    });

    this.arrow = this.add
      .text(W - 34, BOX_Y + BOX_H - 22, '▼', { fontSize: '12px', color: '#8fb3d9' })
      .setVisible(false);

    this.tweens.add({
      targets: this.arrow,
      alpha: 0.25,
      duration: 620,
      yoyo: true,
      repeat: -1,
    });

    this.hintText = this.add
      .text(22, BOX_Y + BOX_H - 20, '', { fontSize: '10px', color: '#6f8194' })
      .setVisible(false);

    this.shopBox = this.add.container(0, 0).setVisible(false);

    // 输入：空格 / 回车 / 点击
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over && over.length > 0) return; // 点到按钮，交给按钮处理
      this.advance();
    });

    this.showLine();

    // 调试入口：?shop=1 直接打开商店
    if (new URLSearchParams(window.location.search).has('shop')) {
      this.openShop();
    }
  }

  // ── 逐字显示 ──
  private showLine() {
    const text = this.lines[this.idx] ?? '';
    this.full = text;
    this.bodyText.setText('');

    // 调试/无头环境：?notype 跳过打字机（Phaser 定时器在部分无头环境不推进）
    if (new URLSearchParams(window.location.search).has('notype')) {
      this.bodyText.setText(text);
      this.typing = false;
      this.afterLine();
      return;
    }

    this.arrow.setVisible(false);
    this.typing = true;
    let i = 0;
    this.typeTimer?.remove();
    this.typeTimer = this.time.addEvent({
      delay: 26,
      repeat: text.length - 1,
      callback: () => {
        i += 1;
        this.bodyText.setText(text.slice(0, i));
        if (i >= text.length) {
          this.typing = false;
          this.afterLine();
        }
      },
    });
  }

  private afterLine() {
    const isLast = this.idx >= this.lines.length - 1;
    this.arrow.setVisible(isLast);
    if (isLast) {
      this.hintText
        .setText(this.npc.role === 'healer' ? '空格继续 · 全员恢复' : '空格继续')
        .setVisible(true);
    }
    this.hintText
      .setText(this.npc.role === 'healer' ? '空格继续 · 全员恢复' : '空格关闭 / 继续')
      .setVisible(isLast);
  }

  private advance() {
    if (this.typing) {
      // 跳过打字动画
      this.typeTimer?.remove();
      this.bodyText.setText(this.full);
      this.typing = false;
      this.afterLine();
      return;
    }
    if (this.idx < this.lines.length - 1) {
      this.idx += 1;
      this.showLine();
      return;
    }
    this.finishNpc();
  }

  // ── 对话结束后触发功能 ──
  private finishNpc() {
    if (this.npc.role === 'healer') {
      const before = party.map((c) => c.hp).join(',');
      healAll();
      const after = party.map((c) => c.hp).join(',');
      this.lines.push(
        before === after ? '你的神兽本就康健，不必费药。' : '好了。山里的草药，比镇上的郎中管用。'
      );
      this.idx = this.lines.length - 1;
      this.showLine();
      return;
    }
    if (this.npc.role === 'shop') {
      this.openShop();
      return;
    }
    this.close();
  }

  // ── 商店 ──
  private openShop() {
    this.bodyText.setVisible(false);
    this.arrow.setVisible(false);
    this.hintText.setVisible(false);
    this.shopBox.removeAll(true);

    this.coinText = this.add.text(W - 150, BOX_Y + 12, '', {
      fontSize: '12px',
      color: '#f0d9a8',
    });
    this.shopBox.add(this.coinText);

    let y = BOX_Y + 32;
    SHOP_ITEMS.forEach((item) => {
      const btn = this.add
        .rectangle(20, y, W - 40, 26, 0x1c2733)
        .setOrigin(0)
        .setStrokeStyle(1, 0x3a4a5c)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(28, y + 5, `${item.name}　${item.price} 文`, {
        fontSize: '12px',
        color: '#e8eef5',
      });
      const desc = this.add.text(160, y + 7, item.desc, { fontSize: '10px', color: '#8fa3b8' });
      const own = this.add.text(W - 90, y + 6, '', { fontSize: '10px', color: '#8fb3d9' });
      const refreshOwn = () => own.setText(`持有 ${countItem(item.id)}`);
      refreshOwn();

      btn.on('pointerdown', () => {
        if (wallet.coins < item.price) {
          this.flashMessage('铜钱不够。');
          return;
        }
        wallet.coins -= item.price;
        addItem(item.id, 1);
        this.updateCoins();
        refreshOwn();
      });
      this.shopBox.add([btn, label, desc, own]);
      y += 28;
    });

    const back = this.add
      .rectangle(20, y, 80, 24, 0x1c2733)
      .setOrigin(0)
      .setStrokeStyle(1, 0x3a4a5c)
      .setInteractive({ useHandCursor: true });
    const backT = this.add.text(46, y + 5, '离开', { fontSize: '12px', color: '#cfe0f0' });
    back.on('pointerdown', () => this.close());
    this.shopBox.add([back, backT]);

    this.shopBox.setVisible(true);
    this.updateCoins();
  }

  private updateCoins() {
    this.coinText.setText(`铜钱 ${wallet.coins}`);
  }

  private flashMessage(msg: string) {
    const t = this.add
      .text(W / 2, BOX_Y + 8, msg, {
        fontSize: '12px',
        color: '#ffd9a0',
        backgroundColor: '#000000cc',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0);
    this.time.delayedCall(900, () => t.destroy());
  }

  private close() {
    this.scene.stop();
    this.scene.resume('Overworld', { dialogClosed: true });
  }
}
