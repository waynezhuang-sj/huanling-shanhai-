import Phaser from 'phaser';
import { MAPS, SOLID, TILE, type MapDef } from '../data/maps';
import UIScene from './UIScene';

const SPEED = 90;

export default class OverworldScene extends Phaser.Scene {
  private mapId = 'town';
  private mapDef!: MapDef;
  private player!: Phaser.Physics.Arcade.Sprite;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private ui!: UIScene;
  private switching = false;
  private lastTile = '';

  constructor() {
    super('Overworld');
  }

  init(data: { mapId?: string }) {
    this.mapId = data.mapId ?? 'town';
    this.switching = false;
    this.lastTile = '';
  }

  create() {
    this.mapDef = MAPS[this.mapId];

    // ── 地图 ──
    const map = this.make.tilemap({
      data: this.mapDef.data,
      tileWidth: 16,
      tileHeight: 16,
    });
    const tileset = map.addTilesetImage('tiles', 'tiles', 16, 16, 0, 0);
    if (!tileset) throw new Error('tileset 加载失败');
    this.layer = map.createLayer(0, tileset, 0, 0)!;
    this.layer.setCollision([...SOLID]);

    // ── 玩家 ──
    const spawnTile = this.spawnTile();
    this.player = this.physics.add.sprite(
      spawnTile.x * 16 + 8,
      spawnTile.y * 16 + 12,
      'hero-down-0'
    );
    this.player.setSize(10, 8);
    this.player.setOffset(3, 15);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.layer);

    // ── 镜头 ──
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setZoom(2);
    this.cameras.main.setBackgroundColor('#1a2a1a');
    this.cameras.main.fadeIn(200, 0, 0, 0);

    // ── 输入 ──
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    // ── UI 场景（独立，不受缩放影响）──
    if (!this.scene.isActive('UI')) {
      this.scene.launch('UI');
    }
    this.ui = this.scene.get('UI') as UIScene;
    const applyName = () => this.ui.setMapName(this.mapDef.name);
    if (this.ui.sys.isActive()) {
      applyName();
    } else {
      this.ui.events.once(Phaser.Scenes.Events.CREATE, applyName);
    }
  }

  /** 入口时用上一张地图 portal 指定的位置 */
  private spawnTile() {
    const from = this.scene.settings.data as { spawn?: { x: number; y: number } } | undefined;
    return from?.spawn ?? this.mapDef.spawn;
  }

  update() {
    if (this.switching) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;

    if (vx !== 0 && vy !== 0) {
      const k = Math.SQRT1_2;
      vx *= k;
      vy *= k;
    }

    body.setVelocity(vx * SPEED, vy * SPEED);

    // 动画
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      let dir = 'down';
      if (Math.abs(vx) > Math.abs(vy) || vy === 0) dir = vx < 0 ? 'left' : 'right';
      else if (vy !== 0) dir = vy < 0 ? 'up' : 'down';
      this.player.anims.play(`walk-${dir}`, true);
    } else {
      this.player.anims.stop();
    }

    // 当前所在图块
    const tx = Math.floor(this.player.x / 16);
    const ty = Math.floor((this.player.y + 8) / 16);
    const key = `${tx},${ty}`;
    if (key === this.lastTile) return;
    this.lastTile = key;

    // portal
    const portal = this.mapDef.portals.find((p) => p.x === tx && p.y === ty);
    if (portal) {
      this.switching = true;
      body.setVelocity(0, 0);
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.restart({ mapId: portal.to, spawn: portal.spawn });
      });
      return;
    }

    // 高草提示（M3 接遇敌）
    const tile = this.layer.getTileAt(tx, ty);
    const suffix = tile && tile.index === TILE.TALL ? '　·　草丛' : '';
    this.ui.setMapName(this.mapDef.name + suffix);
  }
}
