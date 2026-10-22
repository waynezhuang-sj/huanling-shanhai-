import Phaser from 'phaser';
import { SPECIES } from '../data/creatures';
import {
  calcDamage,
  expReward,
  gainExp,
  healAmount,
  movesOf,
  nameOf,
  type CreatureInst,
  type DamageResult,
} from '../battle/engine';
import type { Move } from '../data/creatures';
import { getActive, getActiveIdx, nextAlive, party, setActive, aliveCount } from '../state/party';

const W = 480;
const H = 320;
const MSG_Y = 212;

export default class BattleScene extends Phaser.Scene {
  private enemy!: CreatureInst;
  private player!: CreatureInst;

  private logText!: Phaser.GameObjects.Text;
  private menu!: Phaser.GameObjects.Container;
  private switchMenu!: Phaser.GameObjects.Container;

  private pName!: Phaser.GameObjects.Text;
  private pBar!: Phaser.GameObjects.Rectangle;
  private pHp!: Phaser.GameObjects.Text;
  private pSprite!: Phaser.GameObjects.Image;

  private eName!: Phaser.GameObjects.Text;
  private eBar!: Phaser.GameObjects.Rectangle;
  private eHp!: Phaser.GameObjects.Text;
  private eSprite!: Phaser.GameObjects.Image;

  private busy = false;

  constructor() {
    super({ key: 'Battle' });
  }

  init(data: { enemy: CreatureInst }) {
    this.enemy = data.enemy;
    this.player = getActive();
    this.busy = false;
  }

  create() {
    // 背景
    this.add.rectangle(0, 0, W, H, 0x1a2430).setOrigin(0);
    this.add.rectangle(0, 150, W, 62, 0x223040).setOrigin(0).setAlpha(0.6);

    // 敌方（右上）
    this.eSprite = this.add.image(340, 76, 'creatures', this.enemyFrame()).setScale(2);
    this.eName = this.add.text(16, 18, '', {
      fontSize: '13px',
      color: '#e8eef5',
      fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
    });
    this.add.rectangle(16, 38, 132, 6, 0x2b3746).setOrigin(0);
    this.eBar = this.add.rectangle(16, 38, 132, 6, 0x5ec26a).setOrigin(0);
    this.eHp = this.add.text(152, 33, '', { fontSize: '10px', color: '#9fb0c0' });

    // 我方（左下）
    this.pSprite = this.add.image(120, 178, 'creatures', this.playerFrame()).setScale(2);
    this.pName = this.add.text(248, 172, '', {
      fontSize: '13px',
      color: '#e8eef5',
      fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
    });
    this.add.rectangle(248, 192, 132, 6, 0x2b3746).setOrigin(0);
    this.pBar = this.add.rectangle(248, 192, 132, 6, 0x5ec26a).setOrigin(0);
    this.pHp = this.add.text(384, 187, '', { fontSize: '10px', color: '#9fb0c0' });

    // 消息面板
    this.add.rectangle(0, MSG_Y, W, H - MSG_Y, 0x0d1117).setOrigin(0).setStrokeStyle(2, 0x2b3746);
    this.logText = this.add.text(14, MSG_Y + 10, '', {
      fontSize: '12px',
      color: '#e8eef5',
      fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
      wordWrap: { width: W - 28 },
      lineSpacing: 4,
    });

    this.menu = this.add.container(0, 0).setVisible(false);
    this.switchMenu = this.add.container(0, 0).setVisible(false);

    this.refresh();
    this.buildMenu();

    // 键盘：1-4 选技能，Esc 返回
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.busy) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) this.playerChoose(n - 1);
    });

    this.setLog(`野生的 ${nameOf(this.enemy)} Lv.${this.enemy.level} 出现了！`);
    this.showMenu();
  }

  // ── 帧号 ──
  private enemyFrame() {
    return SPECIES[this.enemy.speciesId].frame;
  }
  private playerFrame() {
    return SPECIES[this.player.speciesId].frame;
  }

  // ── UI 刷新 ──
  private refresh() {
    this.pName.setText(`${nameOf(this.player)}  Lv.${this.player.level}`);
    this.pHp.setText(`${this.player.hp}/${this.player.maxHp}`);
    this.pBar.width = 132 * Math.max(0, this.player.hp / this.player.maxHp);
    this.pBar.fillColor = this.barColor(this.player.hp / this.player.maxHp);

    this.eName.setText(`${nameOf(this.enemy)}  Lv.${this.enemy.level}`);
    this.eHp.setText(`${this.enemy.hp}/${this.enemy.maxHp}`);
    this.eBar.width = 132 * Math.max(0, this.enemy.hp / this.enemy.maxHp);
    this.eBar.fillColor = this.barColor(this.enemy.hp / this.enemy.maxHp);

    this.pSprite.setFrame(this.playerFrame());
    this.eSprite.setFrame(this.enemyFrame());
  }

  private barColor(r: number) {
    if (r > 0.5) return 0x5ec26a;
    if (r > 0.2) return 0xe0b341;
    return 0xd15b4a;
  }

  private setLog(t: string) {
    this.logText.setText(t);
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => this.time.delayedCall(ms, () => resolve()));
  }

  // ── 主菜单：三行布局（4 技能 2 行 + 动作 1 行）──
  private buildMenu() {
    this.menu.removeAll(true);
    const rowY = [MSG_Y + 26, MSG_Y + 54, MSG_Y + 82];
    const BH = 24;
    const moves = movesOf(this.player);

    moves.forEach((m, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 14 + col * 226;
      const y = rowY[row];
      const btn = this.add
        .rectangle(x, y, 218, BH, 0x1c2733)
        .setOrigin(0)
        .setStrokeStyle(1, 0x3a4a5c)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x + 8, y + 5, `${i + 1}. ${m.name}`, {
        fontSize: '12px',
        color: '#e8eef5',
        fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
      });
      const tag = this.add.text(x + 190, y + 6, m.element, {
        fontSize: '10px',
        color: '#8fb3d9',
      });
      btn.on('pointerdown', () => this.playerChoose(i));
      this.menu.add([btn, label, tag]);
    });

    // 换兽 / 逃（第三行）
    const y3 = rowY[2];
    const sw = this.add
      .rectangle(14, y3, 104, BH, 0x1c2733)
      .setOrigin(0)
      .setStrokeStyle(1, 0x3a4a5c)
      .setInteractive({ useHandCursor: true });
    const swT = this.add.text(34, y3 + 5, '换兽', { fontSize: '12px', color: '#e8eef5' });
    sw.on('pointerdown', () => this.openSwitch());

    const run = this.add
      .rectangle(126, y3, 104, BH, 0x1c2733)
      .setOrigin(0)
      .setStrokeStyle(1, 0x3a4a5c)
      .setInteractive({ useHandCursor: true });
    const runT = this.add.text(140, y3 + 5, '逃（50%）', { fontSize: '12px', color: '#e8eef5' });
    run.on('pointerdown', () => this.tryRun());

    this.menu.add([sw, swT, run, runT]);
  }

  private showMenu() {
    if (this.busy) return;
    this.setLog(`要怎么做？　（点击或按 1-4）`);
    this.menu.setVisible(true);
    this.switchMenu.setVisible(false);
  }

  private hideMenu() {
    this.menu.setVisible(false);
    this.switchMenu.setVisible(false);
  }

  // ── 换兽 ──
  private openSwitch() {
    if (this.busy) return;
    this.hideMenu();
    this.switchMenu.removeAll(true);
    const act = getActiveIdx();
    let y = MSG_Y + 30;
    party.forEach((c, i) => {
      if (i === act) return;
      const alive = c.hp > 0;
      const btn = this.add
        .rectangle(14, y, 240, 26, alive ? 0x1c2733 : 0x1a1a1a)
        .setOrigin(0)
        .setStrokeStyle(1, alive ? 0x3a4a5c : 0x2a2a2a)
        .setInteractive({ useHandCursor: alive });
      const t = this.add.text(22, y + 5, `${nameOf(c)} Lv.${c.level}  ${c.hp}/${c.maxHp}`, {
        fontSize: '11px',
        color: alive ? '#e8eef5' : '#666',
      });
      if (alive) btn.on('pointerdown', () => this.doSwitch(i));
      this.switchMenu.add([btn, t]);
      y += 30;
    });
    const back = this.add
      .rectangle(270, MSG_Y + 30, 60, 26, 0x1c2733)
      .setOrigin(0)
      .setStrokeStyle(1, 0x3a4a5c)
      .setInteractive({ useHandCursor: true });
    const bt = this.add.text(282, MSG_Y + 35, '返回', { fontSize: '11px', color: '#cfe0f0' });
    back.on('pointerdown', () => this.showMenu());
    this.switchMenu.add([back, bt]);
    this.switchMenu.setVisible(true);
  }

  private async doSwitch(idx: number) {
    if (this.busy) return;
    this.busy = true;
    this.hideMenu();
    this.setLog(`${nameOf(this.player)}，回来吧！`);
    await this.sleep(500);
    setActive(idx);
    this.player = getActive();
    this.refresh();
    this.setLog(`上吧，${nameOf(this.player)}！`);
    await this.sleep(500);
    // 换兽消耗一回合
    const em = this.pickEnemyMove();
    await this.useMove(this.enemy, this.player, em, 'enemy');
    await this.afterEnemyAction();
  }

  // ── 逃跑 ──
  private async tryRun() {
    if (this.busy) return;
    this.busy = true;
    this.hideMenu();
    if (Math.random() < 0.5) {
      this.setLog('成功逃走了！');
      await this.sleep(600);
      this.endBattle();
    } else {
      this.setLog('没能逃掉！');
      await this.sleep(600);
      const em = this.pickEnemyMove();
      await this.useMove(this.enemy, this.player, em, 'enemy');
      await this.afterEnemyAction();
    }
  }

  // ── 玩家出招 ──
  private async playerChoose(moveIdx: number) {
    if (this.busy) return;
    const moves = movesOf(this.player);
    if (!moves[moveIdx]) return;
    this.busy = true;
    this.hideMenu();

    const pm = moves[moveIdx];
    const em = this.pickEnemyMove();
    const playerFirst = this.player.spd >= this.enemy.spd;

    const seq: Array<{ side: 'p' | 'e'; move: Move }> = playerFirst
      ? [{ side: 'p', move: pm }, { side: 'e', move: em }]
      : [{ side: 'e', move: em }, { side: 'p', move: pm }];

    for (const step of seq) {
      if (this.player.hp <= 0 || this.enemy.hp <= 0) break;
      if (step.side === 'p') {
        await this.useMove(this.player, this.enemy, step.move, 'player');
        if (this.enemy.hp <= 0) break;
      } else {
        await this.useMove(this.enemy, this.player, step.move, 'enemy');
        if (this.player.hp <= 0) break;
      }
    }

    if (this.enemy.hp <= 0) {
      await this.winBattle();
      return;
    }
    if (this.player.hp <= 0) {
      await this.playerFainted();
      return;
    }
    this.busy = false;
    this.showMenu();
  }

  private pickEnemyMove(): Move {
    const ms = movesOf(this.enemy);
    // 血量低时更想回血
    const heal = ms.find((m) => m.kind === 'heal');
    if (heal && this.enemy.hp / this.enemy.maxHp < 0.3 && Math.random() < 0.5) return heal;
    return ms[Math.floor(Math.random() * ms.length)];
  }

  private async useMove(
    attacker: CreatureInst,
    defender: CreatureInst,
    move: Move,
    side: 'player' | 'enemy'
  ) {
    this.setLog(`${nameOf(attacker)} 使用了 ${move.name}！`);
    await this.sleep(520);

    const atkSprite = side === 'player' ? this.pSprite : this.eSprite;
    const baseX = atkSprite.x;
    const dir = side === 'player' ? 1 : -1;
    this.tweens.add({ targets: atkSprite, x: baseX + 14 * dir, duration: 110, yoyo: true });

    if (move.kind === 'heal') {
      const amt = healAmount(attacker, move);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + amt);
      this.refresh();
      this.setLog(`${nameOf(attacker)} 恢复了 ${amt} 点体力。`);
      await this.sleep(560);
      return;
    }

    const res: DamageResult = calcDamage(attacker, defender, move);
    defender.hp = Math.max(0, defender.hp - res.damage);
    this.refresh();
    this.cameras.main.shake(90, 0.006);
    this.setLog(res.label ? `${res.label}！造成 ${res.damage} 点伤害。` : `造成 ${res.damage} 点伤害。`);
    await this.sleep(620);
  }

  private async afterEnemyAction() {
    if (this.player.hp <= 0) {
      await this.playerFainted();
      return;
    }
    this.busy = false;
    this.showMenu();
  }

  // ── 我方倒下 ──
  private async playerFainted() {
    this.setLog(`${nameOf(this.player)} 倒下了！`);
    await this.sleep(700);
    const idx = nextAlive(getActiveIdx());
    if (idx < 0) {
      this.setLog('全队失去战力…眼前一黑，被送回了青丘镇。');
      await this.sleep(1400);
      this.endBattle(true);
      return;
    }
    setActive(idx);
    this.player = getActive();
    this.refresh();
    this.setLog(`上吧，${nameOf(this.player)}！`);
    await this.sleep(700);
    this.busy = false;
    this.showMenu();
  }

  // ── 胜利 ──
  private async winBattle() {
    this.setLog(`野生的 ${nameOf(this.enemy)} 倒下了！`);
    await this.sleep(700);
    const gain = expReward(this.enemy.level);
    const ups = gainExp(this.player, gain);
    this.refresh();
    this.setLog(`${nameOf(this.player)} 获得 ${gain} 点经验。`);
    await this.sleep(700);
    if (ups > 0) {
      this.setLog(`${nameOf(this.player)} 升到 Lv.${this.player.level}！`);
      await this.sleep(800);
    }
    this.endBattle(false);
  }

  private endBattle(lost = false) {
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.time.delayedCall(200, () => {
      this.scene.stop();
      this.scene.resume('Overworld', { battleLost: lost });
    });
  }
}
