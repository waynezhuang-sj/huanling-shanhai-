import Phaser from 'phaser';
import { MAPS, SOLID, TILE, type MapDef } from '../data/maps';
import UIScene from './UIScene';

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

    this.layer = map.createBlankLayer('objects', tileset)!;
    this.mapDef.objects.forEach((row, y) =>
      row.forEach((t, x) => {
        if (t >= 0) this.layer.putTileAt(t, x, y);
      })
    );
    this.layer.setCollision([...SOLID]);
    this.layer.setDepth(2);

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

    // ── 触屏摇杆 ──
    const setVirtual = (pointer: Phaser.Input.Pointer) => {
      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;
      const dx = pointer.x - cx;
      const dy = pointer.y - cy;
      const len = Math.hypot(dx, dy);
      if (len < 24) {
        this.virtual.x = 0;
        this.virtual.y = 0;
        return;
      }
      this.virtual.x = dx / len;
      this.virtual.y = dy / len;
    };
    this.input.on('pointerdown', setVirtual);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) setVirtual(p);
    });
    this.input.on('pointerup', () => {
      this.virtual.x = 0;
      this.virtual.y = 0;
    });

    // ── UI ──
    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    this.ui = this.scene.get('UI') as UIScene;
    const applyName = () => this.refreshLabel();
    if (this.ui.sys.isActive()) applyName();
    else this.ui.events.once(Phaser.Scenes.Events.CREATE, applyName);
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

    // ── 图块检测 ──
    const tx = Math.floor(this.player.x / TS);
    const ty = Math.floor((this.player.y + 6) / TS);
    const key = `${tx},${ty}`;
    if (key === this.lastTile) return;
    this.lastTile = key;

    const portal = this.mapDef.portals.find((p) => p.x === tx && p.y === ty);
    if (portal) {
      this.switching = true;
      body.setVelocity(0, 0);
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.restart({ mapId: portal.to, spawn: portal.spawn });
      });
    }
  }
}
