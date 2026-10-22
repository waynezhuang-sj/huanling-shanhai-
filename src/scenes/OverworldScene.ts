import Phaser from 'phaser';
import { MAPS, SOLID, TILE, type MapDef } from '../data/maps';
import UIScene from './UIScene';
import { rollWild } from '../battle/engine';
import { WILD_TABLE } from '../data/creatures';
import { healAll } from '../state/party';
import { NPCS, type NpcDef } from '../data/npcs';

const SPEED = 84;
const TS = 16;

export default class OverworldScene extends Phaser.Scene {
  private mapId = 'town';
  private mapDef!: MapDef;
  private player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private ui!: UIScene;
  private switching = false;
  private lastTile = '';
  private virtual = { x: 0, y: 0 };
  private battleActive = false;
  private stepCounter = 0;
  private npcSprites: { sprite: Phaser.GameObjects.Sprite; def: NpcDef }[] = [];
  private nearNpc: NpcDef | null = null;
  private portalArmed = false;
  private moving = false;

  constructor() {
    super('Overworld');
  }

  init(data: { mapId?: string }) {
    this.mapId = data.mapId ?? 'town';
    this.switching = false;
    this.lastTile = '';
    this.moving = false;
  }

  create() {
    this.mapDef = MAPS[this.mapId];

    // ── 地图：地面层 + 物件层 ──
    const h = this.mapDef.ground.length;
    const w = this.mapDef.ground[0].length;
    const map = this.make.tilemap({ tileWidth: TS, tileHeight: TS, width: w, height: h });
    const tileset = map.addTilesetImage('atlas', 'atlas', TS, TS, 0, 0);
    if (!tileset) throw new Error('atlas 图集加载失败');

    const groundLayer = map.createBlankLayer('ground', tileset)!;
    groundLayer.putTilesAt(this.mapDef.ground, 0, 0);

    // 美术投影独立于物件与碰撞，透明处仍显示原地面。
    const shade = this.add.graphics().setDepth(1);
    shade.fillStyle(0x263329, 0.22);
    for (const house of this.mapDef.houses) {
      shade.fillRect(house.x * TS + 3, house.y * TS + 4, house.width * TS, house.height * TS);
    }
    this.mapDef.objects.forEach((row, y) => row.forEach((tile, x) => {
      if (([TILE.TREE_ROUND, TILE.TREE_ROUND2, TILE.TREE_LEAFY, TILE.TREE_AUTUMN] as number[]).includes(tile)) {
        shade.fillEllipse(x * TS + 9, y * TS + 14, 14, 5);
      } else if (([TILE.FENCE_L, TILE.FENCE_M, TILE.FENCE_R] as number[]).includes(tile)) {
        shade.fillRect(x * TS + 2, y * TS + 11, TS, 4);
      }
    }));

    this.layer = map.createBlankLayer('objects', tileset)!;
    this.mapDef.objects.forEach((row, y) =>
      row.forEach((t, x) => {
        if (t >= 0) this.layer.putTileAt(t, x, y);
      })
    );
    this.layer.setCollision([...SOLID]);
    this.layer.setDepth(2);

    // 第四行屋顶的下沿是檐口：只加 2px 半透明压边，不替换图集。
    const eaves = this.add.graphics().setDepth(2.1);
    eaves.fillStyle(0x30252a, 0.3);
    for (const house of this.mapDef.houses) {
      eaves.fillRect(house.x * TS, (house.y + 4) * TS - 2, house.width * TS, 2);
    }

    // ── 玩家 ──
    const spawn = this.spawnTile();
    const px = spawn.x * TS + TS / 2;
    const py = spawn.y * TS + TS / 2;

    this.shadow = this.add.ellipse(px, py + 6, 10, 4, 0x000000, 0.25).setDepth(1);

    this.player = this.physics.add.sprite(px, py, 'atlas', TILE.HERO);
    this.player.setDepth(3);
    this.player.setSize(10, 8);
    this.player.setOffset(3, 8);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.layer);

    // ── NPC ──
    this.npcSprites = [];
    for (const n of NPCS.filter((n) => n.map === this.mapDef.id)) {
      const sx = n.x * TS + TS / 2;
      const sy = n.y * TS + TS / 2;
      const s = this.physics.add.sprite(sx, sy, 'atlas', n.frame).setDepth(3);
      const b = s.body as Phaser.Physics.Arcade.Body;
      b.setSize(10, 8).setOffset(3, 8).setImmovable(true);
      this.physics.add.collider(this.player, s);
      s.setInteractive({ useHandCursor: true });
      s.on('pointerdown', () => {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, sx, sy);
        if (d <= 30) {
          this.nearNpc = n;
          this.tryTalk();
        } else {
          this.ui?.setPrompt('走近一些才能交谈');
          this.time.delayedCall(1000, () => this.ui?.setPrompt(''));
        }
      });
      this.npcSprites.push({ sprite: s, def: n });
    }

    // 交谈键
    this.input.keyboard?.on('keydown-E', () => this.tryTalk());
    this.input.keyboard?.on('keydown-SPACE', () => this.tryTalk());

    // ── 镜头 ──
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.setZoom(2.5);
    this.cameras.main.resetFX();
    this.cameras.main.setBackgroundColor('#12181f');

    // ── 输入 ──
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    // ── 触屏摇杆：按下即定向（相对屏幕中心），拖动后改为「以按下点为原点」──
    let joyOrigin: { x: number; y: number } | null = null;
    const DEAD = 10;

    const applyDir = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy);
      if (len < DEAD) {
        this.virtual.x = 0;
        this.virtual.y = 0;
      } else {
        this.virtual.x = dx / len;
        this.virtual.y = dy / len;
      }
    };

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      joyOrigin = { x: p.x, y: p.y };
      // 按下瞬间先按「相对屏幕中心」定向，保证点哪都能立刻动
      applyDir(p.x - this.scale.width / 2, p.y - this.scale.height / 2);
      this.ui?.showJoystick(p.x, p.y, p.x, p.y);
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!joyOrigin || !p.isDown) return;
      applyDir(p.x - joyOrigin.x, p.y - joyOrigin.y);
      this.ui?.showJoystick(joyOrigin.x, joyOrigin.y, p.x, p.y);
    });

    this.input.on('pointerup', () => {
      joyOrigin = null;
      this.virtual.x = 0;
      this.virtual.y = 0;
      this.ui?.hideJoystick();
    });

    // ── UI ──
    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    this.ui = this.scene.get('UI') as UIScene;
    const applyName = () => this.refreshLabel();
    if (this.ui.sys.isActive()) applyName();
    else this.ui.events.once(Phaser.Scenes.Events.CREATE, applyName);

    // 战斗结束返回
    this.events.on(Phaser.Scenes.Events.RESUME, (_sys: unknown, data?: { battleLost?: boolean }) => {
      this.battleActive = false;
      this.stepCounter = 0;
      if (data?.battleLost) {
        healAll();
        this.cameras.main.resetFX();
        this.scene.restart({ mapId: 'town', spawn: MAPS.town.spawn });
      }
    });

    // 调试入口：URL 带 ?battle=1 直接开战斗场景（便于验收/截图）
    if (new URLSearchParams(window.location.search).has('battle')) {
      this.scene.launch('Battle', { enemy: rollWild(WILD_TABLE) });
    }

    // 调试入口：?dialog=healer / merchant / villager 直接打开对话
    const q = new URLSearchParams(window.location.search);
    if (q.has('dialog')) {
      const id = q.get('dialog') || 'villager';
      const npc = NPCS.find((n) => n.id === id);
      if (npc) this.scene.launch('Dialog', { npc });
    }
  }

  /** 与最近的 NPC 交谈 */
  private tryTalk() {
    if (this.battleActive || this.switching || !this.nearNpc) return;
    this.scene.pause();
    this.scene.launch('Dialog', { npc: this.nearNpc });
  }

  /** 野区遇敌：暂停探索，启动战斗场景 */
  private startBattle() {
    this.battleActive = true;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    this.cameras.main.flash(160, 255, 255, 255);
    this.time.delayedCall(180, () => {
      this.scene.pause();
      this.scene.launch('Battle', { enemy: rollWild(WILD_TABLE) });
    });
  }

  private spawnTile() {
    const from = this.scene.settings.data as { spawn?: { x: number; y: number } } | undefined;
    return from?.spawn ?? this.mapDef.spawn;
  }

  private refreshLabel() {
    const tag = this.mapDef.wild ? '　·　野区' : '';
    this.ui.setMapName(this.mapDef.name + tag);
  }

  update(time: number) {
    if (this.switching) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;

    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    if (this.virtual.x !== 0 || this.virtual.y !== 0) {
      vx = this.virtual.x;
      vy = this.virtual.y;
    }

    body.setVelocity(vx * SPEED, vy * SPEED);
    this.moving = vx !== 0 || vy !== 0;

    // 朝向：水平翻转
    if (vx < -0.1) this.player.setFlipX(true);
    else if (vx > 0.1) this.player.setFlipX(false);

    // 走动时上下轻微起伏，替代行走帧
    if (this.moving) {
      this.player.scaleY = 1 + Math.sin(time * 0.018) * 0.06;
      this.player.y += Math.sin(time * 0.018) * 0.0; // 保持物理位置
    } else {
      this.player.scaleY = 1;
    }

    // 影子跟随
    this.shadow.setPosition(this.player.x, this.player.y + 7);

    // ── 靠近 NPC 提示 ──
    if (this.npcSprites.length) {
      let best: NpcDef | null = null;
      let bestD = 28;
      for (const { sprite, def } of this.npcSprites) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
        if (d < bestD) {
          bestD = d;
          best = def;
        }
      }
      this.nearNpc = best;
      this.ui?.setPrompt(best ? `${best.name}　·　按 E 交谈` : '');
    }

    // ── 传送点：按距离判定 + 到达保护（必须先离开再回来才生效）──
    if (!this.switching && !this.battleActive) {
      const px = this.player.x;
      const py = this.player.y + 6;
      const within = (p: { x: number; y: number }, r: number) =>
        Math.abs(px - (p.x * TS + TS / 2)) <= r && Math.abs(py - (p.y * TS + TS / 2)) <= r;

      if (!this.portalArmed) {
        // 刚落地：先离开传送区 20px 以外，才允许再次触发，避免被瞬间弹回
        if (!this.mapDef.portals.some((p) => within(p, 20))) this.portalArmed = true;
      } else {
        const portal = this.mapDef.portals.find((p) => within(p, 12));
        if (portal) {
          this.switching = true;
          this.portalArmed = false;
          body.setVelocity(0, 0);
          this.cameras.main.fadeOut(200, 0, 0, 0);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.restart({ mapId: portal.to, spawn: portal.spawn });
          });
          return;
        }
      }
    }

    // ── 图块检测（用于遇敌计数）──
    const tx = Math.floor(this.player.x / TS);
    const ty = Math.floor((this.player.y + 6) / TS);
    const key = `${tx},${ty}`;
    if (key === this.lastTile) return;
    this.lastTile = key;

    // ── 野区随机遇敌 ──
    if (this.mapDef.wild && !this.switching && !this.battleActive) {
      this.stepCounter += 1;
      if (this.stepCounter >= 2) {
        this.stepCounter = 0;
        if (Math.random() < 0.16) {
          this.startBattle();
        }
      }
    }
  }
}
