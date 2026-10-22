/**
 * 图块索引 —— 对应 public/assets/atlas.png 的帧号。
 * 0-131   : Kenney Tiny Town
 * 132-263 : Kenney Tiny Dungeon
 * 授权 CC0 1.0 · kenney.nl
 */
export const TILE = {
  // ── 地面（只放地面层）──
  GRASS: 0,
  GRASS2: 1,
  PATH: 25, // 最干净的土路（无边框、无杂点）

  // ── 覆盖物（放物件层，背景透明）──
  FLOWER: 2,
  TREE_ROUND: 16, // 圆冠树（绿）
  TREE_ROUND2: 5, // 圆冠树（另一变体）
  TREE_LEAFY: 28, // 叶簇树（绿）
  TREE_AUTUMN: 15, // 秋色树（橙，增加层次）
  SHRUB: 18,
  MUSHROOM: 29,
  BUSH: 30,

  // ── 栅栏（左/中/右，连接成排）──
  FENCE_L: 44,
  FENCE_M: 45,
  FENCE_R: 46,

  // ── 建筑 ──
  ROOF_TOP: 67,
  ROOF_L: 64,
  ROOF_M: 65,
  ROOF_R: 66,
  WALL_L: 52,
  WALL_M: 53,
  WALL_R: 54,
  DOOR: 85,
  WINDOW: 55,
  SIGN: 83,

  // ── 角色（Tiny Dungeon，+132 偏移）──
  HERO: 217, // Tiny Dungeon d85：橙发青年，有腿
  CREATURE_GREEN: 240,
  CREATURE_ORANGE: 241,
  CREATURE_RED: 242,
  CREATURE_ORC: 243,
  CREATURE_FUZZY: 252,
  CREATURE_SPIDER: 254,
} as const;

const TREES = [
  TILE.TREE_ROUND,
  TILE.TREE_ROUND2,
  TILE.TREE_LEAFY,
  TILE.TREE_AUTUMN,
];

/** 走不过去的图块 */
export const SOLID: number[] = [
  ...TREES,
  TILE.BUSH,
  TILE.FENCE_L,
  TILE.FENCE_M,
  TILE.FENCE_R,
  TILE.ROOF_TOP,
  TILE.ROOF_L,
  TILE.ROOF_M,
  TILE.ROOF_R,
  TILE.WALL_L,
  TILE.WALL_M,
  TILE.WALL_R,
  TILE.DOOR,
  TILE.WINDOW,
  TILE.SIGN,
];

export interface Portal {
  x: number;
  y: number;
  to: string;
  spawn: { x: number; y: number };
}

export interface MapDef {
  id: string;
  name: string;
  wild?: boolean;
  ground: number[][];
  objects: number[][];
  spawn: { x: number; y: number };
  portals: Portal[];
}

function grid(w: number, h: number, fill: number): number[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

function rect(g: number[][], x0: number, y0: number, x1: number, y1: number, t: number) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (g[y] && g[y][x] !== undefined) g[y][x] = t;
    }
  }
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** 房子：屋脊 + 屋顶 + 两层墙 + 窗 + 门（共 4 行高） */
function house(obj: number[][], x0: number, y0: number, w: number, doorOffset: number) {
  // 屋脊
  const mid = x0 + Math.floor(w / 2);
  obj[y0][mid] = TILE.ROOF_TOP;

  // 屋顶
  for (let i = 0; i < w; i++) {
    obj[y0 + 1][x0 + i] = i === 0 ? TILE.ROOF_L : i === w - 1 ? TILE.ROOF_R : TILE.ROOF_M;
  }
  // 上层墙
  for (let i = 0; i < w; i++) {
    obj[y0 + 2][x0 + i] = i === 0 ? TILE.WALL_L : i === w - 1 ? TILE.WALL_R : TILE.WALL_M;
  }
  obj[y0 + 2][x0 + 1] = TILE.WINDOW;
  if (w >= 5) obj[y0 + 2][x0 + w - 2] = TILE.WINDOW;
  // 下层墙 + 门
  for (let i = 0; i < w; i++) {
    obj[y0 + 3][x0 + i] = i === 0 ? TILE.WALL_L : i === w - 1 ? TILE.WALL_R : TILE.WALL_M;
  }
  obj[y0 + 3][x0 + doorOffset] = TILE.DOOR;
}

/** 一排连起来的栅栏 */
function fenceRow(obj: number[][], x0: number, x1: number, y: number) {
  for (let x = x0; x <= x1; x++) {
    obj[y][x] = x === x0 ? TILE.FENCE_L : x === x1 ? TILE.FENCE_R : TILE.FENCE_M;
  }
}

/** 一片树丛（品种随机混用，避免呆板） */
function grove(
  obj: number[][],
  r: () => number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!obj[y] || obj[y][x] === undefined) continue;
      const roll = r();
      obj[y][x] = TREES[Math.floor(r() * TREES.length)];
    }
  }
}

// ───────────────────── 城镇：青丘镇 ─────────────────────
function buildTown(): MapDef {
  const w = 30;
  const h = 22;
  const ground = grid(w, h, TILE.GRASS);
  const obj = grid(w, h, -1);
  const r = rng(7);

  // 草地纹理
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) if (r() > 0.78) ground[y][x] = TILE.GRASS2;

  // 主路：横贯 y=11，纵向 x=14
  rect(ground, 0, 11, w - 1, 12, TILE.PATH);
  rect(ground, 14, 0, 15, h - 1, TILE.PATH);

  // 两栋房子（4 行高）
  house(obj, 3, 3, 7, 3); // 医馆
  house(obj, 20, 3, 7, 3); // 杂货铺

  // 外围树林
  grove(obj, r, 0, 0, w - 1, 0);
  grove(obj, r, 0, h - 1, w - 1, h - 1);
  grove(obj, r, 0, 0, 0, h - 1);
  grove(obj, r, w - 1, 0, w - 1, h - 1);

  // 镇内树丛
  grove(obj, r, 2, 9, 4, 10);
  grove(obj, r, 25, 9, 27, 10);
  grove(obj, r, 2, 17, 5, 19);
  grove(obj, r, 24, 17, 27, 19);

  // 树丛点缀
  for (const [x, y] of [[7, 10], [19, 10], [11, 7], [18, 7], [10, 16], [20, 16]] as [number, number][])
    obj[y][x] = TREES[Math.floor(r() * TREES.length)];
  // 花
  for (const [x, y] of [[6, 9], [21, 9], [12, 18], [17, 6]] as [number, number][]) obj[y][x] = TILE.FLOWER;
  obj[19][8] = TILE.MUSHROOM;

  // 花
  for (const [x, y] of [
    [3, 8], [8, 13], [12, 8], [17, 13], [22, 8], [26, 8], [4, 14], [24, 14], [13, 3], [16, 18],
  ] as [number, number][])
    if (obj[y][x] === -1) obj[y][x] = TILE.FLOWER;

  // 沿路栅栏（左右两段，连成排）
  fenceRow(obj, 3, 11, 13);
  fenceRow(obj, 18, 26, 13);

  // 路牌
  obj[10][13] = TILE.SIGN;

  return {
    id: 'town',
    name: '青丘镇',
    ground,
    objects: obj,
    spawn: { x: 14, y: 15 },
    portals: [{ x: 0, y: 11, to: 'field', spawn: { x: 2, y: 13 } }],
  };
}

// ───────────────────── 野区：青丘野径 ─────────────────────
function buildField(): MapDef {
  const w = 38;
  const h = 28;
  const ground = grid(w, h, TILE.GRASS);
  const obj = grid(w, h, -1);
  const r = rng(31);

  // 野区地面偏深
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) if (r() > 0.3) ground[y][x] = TILE.GRASS2;

  // 入口小路
  rect(ground, 0, 12, 8, 13, TILE.PATH);

  // 外围树林
  grove(obj, r, 0, 0, w - 1, 0);
  grove(obj, r, 0, h - 1, w - 1, h - 1);
  grove(obj, r, 0, 0, 0, h - 1);
  grove(obj, r, w - 1, 0, w - 1, h - 1);

  // 四片树林围出通道
  grove(obj, r, 11, 2, 19, 8);
  grove(obj, r, 23, 2, 31, 7);
  grove(obj, r, 13, 17, 23, 25);
  grove(obj, r, 27, 15, 35, 21);

  // 灌木
  for (const [x, y] of [
    [10, 11], [20, 12], [25, 10], [9, 17], [12, 11], [18, 16], [26, 11], [32, 10], [31, 23], [15, 11],
  ] as [number, number][])
    if (obj[y][x] === -1) obj[y][x] = TREES[Math.floor(r() * TREES.length)];

  // 小草 / 蘑菇 / 花
  for (let i = 0; i < 18; i++) {
    const x = 1 + Math.floor(r() * (w - 2));
    const y = 1 + Math.floor(r() * (h - 2));
    if (obj[y][x] === -1) obj[y][x] = TILE.FLOWER;
  }
  obj[9][14] = TILE.MUSHROOM;
  obj[20][29] = TILE.MUSHROOM;

  return {
    id: 'field',
    name: '青丘野径',
    wild: true,
    ground,
    objects: obj,
    spawn: { x: 5, y: 12 },
    portals: [{ x: 0, y: 12, to: 'town', spawn: { x: 2, y: 11 } }],
  };
}

export const MAPS: Record<string, MapDef> = {
  town: buildTown(),
  field: buildField(),
};
