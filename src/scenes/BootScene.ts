import Phaser from 'phaser';

/** 图块种类（与 maps.ts 的 TILE 对应） */
export const TILE_SIZE = 16;

const COLORS = {
  grass: ['#4a7c3f', '#3f6b36', '#568a48'],
  path: ['#b09a72', '#a08b66', '#c0aa80'],
  tree: ['#2f5d33', '#24471f', '#3a6f3e'],
  water: ['#2f6f9f', '#3f86b8', '#28608c'],
  wall: ['#8a6a4a', '#6b4f36', '#9c7a58'],
  tall: ['#5c8f45', '#74a34f', '#4a7a38'],
  flower: ['#4a7c3f', '#d76a8a', '#e8e0d0'],
  door: ['#4a3524', '#3a2818', '#5a4230'],
};

type Ctx = CanvasRenderingContext2D;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void) {
  const canvas = scene.textures.createCanvas(key, w, h);
  if (!canvas) throw new Error('createCanvas failed: ' + key);
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  canvas.refresh();
}

/** 用固定伪随机保证每次生成的贴图一致 */
function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function drawTile(ctx: Ctx, ox: number, kind: number) {
  const r = rnd(kind * 977 + 13);
  switch (kind) {
    case 0: // 草地
    case 6: // 花（草地打底）
      ctx.fillStyle = COLORS.grass[0];
      ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = COLORS.grass[r() > 0.5 ? 1 : 2];
        ctx.fillRect(ox + Math.floor(r() * TILE_SIZE), Math.floor(r() * TILE_SIZE), 1, 1);
      }
      if (kind === 6) {
        ctx.fillStyle = COLORS.flower[1];
        ctx.fillRect(ox + 5, 5, 3, 3);
        ctx.fillStyle = COLORS.flower[2];
        ctx.fillRect(ox + 6, 6, 1, 1);
        ctx.fillStyle = COLORS.flower[1];
        ctx.fillRect(ox + 10, 9, 3, 3);
      }
      break;
    case 1: // 土路
      ctx.fillStyle = COLORS.path[0];
      ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
      for (let i = 0; i < 22; i++) {
        ctx.fillStyle = COLORS.path[r() > 0.5 ? 1 : 2];
        ctx.fillRect(ox + Math.floor(r() * TILE_SIZE), Math.floor(r() * TILE_SIZE), 2, 1);
      }
      break;
    case 2: // 树
      ctx.fillStyle = COLORS.grass[1];
      ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
      // 树干
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(ox + 7, 11, 2, 5);
      // 树冠：分层圆角轮廓
      ctx.fillStyle = COLORS.tree[1];
      ctx.fillRect(ox + 4, 1, 8, 2);
      ctx.fillRect(ox + 2, 3, 12, 2);
      ctx.fillRect(ox + 1, 5, 14, 5);
      ctx.fillRect(ox + 3, 10, 10, 2);
      ctx.fillStyle = COLORS.tree[0];
      ctx.fillRect(ox + 3, 3, 10, 2);
      ctx.fillRect(ox + 2, 5, 12, 4);
      ctx.fillRect(ox + 4, 9, 8, 2);
      // 高光
      ctx.fillStyle = COLORS.tree[2];
      ctx.fillRect(ox + 4, 3, 3, 2);
      ctx.fillRect(ox + 3, 5, 2, 2);
      break;
    case 3: // 水
      ctx.fillStyle = COLORS.water[0];
      ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = COLORS.water[2];
      ctx.fillRect(ox, 0, TILE_SIZE, 2);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = COLORS.water[1];
        ctx.fillRect(ox + Math.floor(r() * 12), 3 + i * 3, 3 + Math.floor(r() * 3), 1);
      }
      break;
    case 4: // 墙
      ctx.fillStyle = COLORS.wall[0];
      ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = COLORS.wall[1];
      ctx.fillRect(ox, 0, TILE_SIZE, 1);
      ctx.fillRect(ox, 8, TILE_SIZE, 1);
      ctx.fillRect(ox + 5, 1, 1, 7);
      ctx.fillRect(ox + 11, 9, 1, 7);
      ctx.fillStyle = COLORS.wall[2];
      ctx.fillRect(ox + 1, 2, 3, 2);
      break;
    case 5: // 高草（遇敌）
      ctx.fillStyle = COLORS.tall[0];
      ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
      for (let i = 0; i < 9; i++) {
        const x = ox + 1 + i * 2;
        ctx.fillStyle = COLORS.tall[i % 2 ? 1 : 2];
        ctx.fillRect(x, 3 + Math.floor(r() * 4), 1, 9);
        ctx.fillRect(x + 1, 5 + Math.floor(r() * 3), 1, 7);
      }
      break;
    case 7: // 门
      ctx.fillStyle = COLORS.door[0];
      ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = COLORS.door[1];
      ctx.fillRect(ox + 2, 0, 12, TILE_SIZE);
      ctx.fillStyle = COLORS.door[2];
      ctx.fillRect(ox + 3, 1, 10, 2);
      ctx.fillStyle = '#d8c070';
      ctx.fillRect(ox + 11, 8, 1, 2);
      break;
  }
}

/**
 * 角色 16×24，4 方向 × 3 帧
 * 方向顺序：0=下 1=左 2=右 3=上
 */
function drawPlayer(ctx: Ctx, ox: number, dir: number, frame: number) {
  const SKIN = '#e0b48c';
  const HAIR = '#1a1a1a';
  const ROBE = '#e8e0d0';
  const OUTER = '#2f4f4f';
  const BOOT = '#2a2a2a';

  const step = frame === 1 ? 1 : 0; // 中间帧抬腿
  const bob = frame === 1 ? 1 : 0;

  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(ox + 4, 22, 8, 2);

  // 腿
  ctx.fillStyle = BOOT;
  if (dir === 1) {
    ctx.fillRect(ox + 5, 18 - step, 3, 5 + step);
    ctx.fillRect(ox + 9, 18, 3, 5);
  } else if (dir === 2) {
    ctx.fillRect(ox + 4, 18, 3, 5);
    ctx.fillRect(ox + 8, 18 - step, 3, 5 + step);
  } else {
    ctx.fillRect(ox + 4, 18, 3, 5 - step);
    ctx.fillRect(ox + 9, 18, 3, 5 - step);
  }

  // 袍身
  ctx.fillStyle = OUTER;
  ctx.fillRect(ox + 3, 9 + bob, 10, 10 - bob);
  ctx.fillStyle = ROBE;
  ctx.fillRect(ox + 5, 10 + bob, 6, 8 - bob);
  // 交领
  ctx.fillStyle = OUTER;
  ctx.fillRect(ox + 6, 10 + bob, 1, 5);
  ctx.fillRect(ox + 9, 10 + bob, 1, 5);

  // 头
  ctx.fillStyle = SKIN;
  ctx.fillRect(ox + 5, 3 + bob, 7, 6);
  // 发
  ctx.fillStyle = HAIR;
  ctx.fillRect(ox + 4, 1 + bob, 9, 4);
  if (dir === 3) {
    // 背面：整块头发
    ctx.fillRect(ox + 4, 3 + bob, 9, 8);
  } else if (dir === 0) {
    ctx.fillRect(ox + 4, 3 + bob, 2, 5);
    ctx.fillRect(ox + 11, 3 + bob, 2, 5);
    // 眼睛
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(ox + 6, 6 + bob, 1, 1);
    ctx.fillRect(ox + 10, 6 + bob, 1, 1);
  } else if (dir === 1) {
    ctx.fillRect(ox + 4, 3 + bob, 3, 6);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(ox + 5, 6 + bob, 1, 1);
  } else {
    ctx.fillRect(ox + 10, 3 + bob, 3, 6);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(ox + 10, 6 + bob, 1, 1);
  }
}

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // 1) 图块集：8 种图块横排成一张图
    tex(this, 'tiles', TILE_SIZE * 8, TILE_SIZE, (ctx) => {
      for (let i = 0; i < 8; i++) drawTile(ctx, i * TILE_SIZE, i);
    });

    // 2) 角色：4 方向 × 3 帧，横向排列
    const DIRS = ['down', 'left', 'right', 'up'];
    for (let d = 0; d < 4; d++) {
      for (let f = 0; f < 3; f++) {
        tex(this, `hero-${DIRS[d]}-${f}`, 16, 24, (ctx) => drawPlayer(ctx, 0, d, f));
      }
    }

    // 3) 动画
    for (let d = 0; d < 4; d++) {
      const name = DIRS[d];
      this.anims.create({
        key: `walk-${name}`,
        frames: [
          { key: `hero-${name}-0` },
          { key: `hero-${name}-1` },
          { key: `hero-${name}-2` },
          { key: `hero-${name}-1` },
        ],
        frameRate: 8,
        repeat: -1,
      });
    }

    // 4) 纯色 UI 底板（对话框用）
    tex(this, 'ui-box', 32, 32, (ctx) => {
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = '#e8e0d0';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 30, 30);
    });

    this.scene.start('Overworld', { mapId: 'town' });
  }
}
