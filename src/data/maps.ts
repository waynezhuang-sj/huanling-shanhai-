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
  PATH: 13,

  // ── 覆盖物（放物件层，背景透明）──
  FLOWER: 2,
  TREE: 16,
  BUSH: 19,
  FENCE: 44,
  // ── 建筑（带左/中/右变体）──
  ROOF_L: 64,
  ROOF_M: 65,
  ROOF_R: 66,
  WALL_L: 52,
  WALL_M: 53,
  WALL_R: 54,
  DOOR: 85, // 带门框的门
  WINDOW: 55, // 砖墙上的窗
  DOOR_BIG: 74,
  SIGN: 83,

  // ── 角色（Tiny Dungeon，+132 偏移）──
  HERO: 232,
  CREATURE_GREEN: 240,
  CREATURE_ORANGE: 241,
  CREATURE_RED: 242,
  CREATURE_ORC: 243,
  CREATURE_FUZZY: 252,
  CREATURE_SPIDER: 254,
} as const;

/** 走不过去的图块 */
export const SOLID: number[] = [
  TILE.TREE,
  TILE.BUSH,
  TILE.FENCE,
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
  /** 地面层：必须是实心图块 */
  ground: number[][];
  /** 物件层：-1 表示空 */
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

/** 房子：屋顶一行（左/中/右）+ 墙体一行（左/中/右）+ 门 + 窗 */
function house(obj: number[][], x0: number, y0: number, w: number, doorOffset: number) {
  for (let i = 0; i < w; i++) {
    obj[y0][x0 + i] = i === 0 ? TILE.ROOF_L : i === w - 1 ? TILE.ROOF_R : TILE.ROOF_M;
  }
  for (let i = 0; i < w; i++) {
    obj[y0 + 1][x0 + i] = i === 0 ? TILE.WALL_L : i === w - 1 ? TILE.WALL_R : TILE.WALL_M;
  }
  obj[y0 + 1][x0 + 1] = TILE.WINDOW;
  obj[y0 + 1][x0 + doorOffset] = TILE.DOOR;
}

// ───────────────────── 城镇：青丘镇 ─────────────────────
function buildTown(): MapDef {
  const w = 28;
  const h = 20;
  const ground = grid(w, h, TILE.GRASS);
  const obj = grid(w, h, -1);
  const r = rng(7);

  // 草地纹理
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) if (r() > 0.75) ground[y][x] = TILE.GRASS2;

  // 主路（横 + 纵）
  rect(ground, 0, 10, w - 1, 11, TILE.PATH);
  rect(ground, 13, 0, 14, h - 1, TILE.PATH);

  // 房屋
  house(obj, 4, 4, 6, 2);
  house(obj, 18, 4, 6, 3);

  // 外围树林
  for (let x = 0; x < w; x++) {
    obj[0][x] = TILE.TREE;
    obj[h - 1][x] = TILE.TREE;
  }
  for (let y = 0; y < h; y++) {
    obj[y][0] = TILE.TREE;
    obj[y][w - 1] = TILE.TREE;
  }

  // 树丛
  const groves: [number, number, number, number][] = [
    [2, 2, 3, 4],
    [23, 2, 2, 3],
    [2, 14, 2, 3],
    [24, 14, 2, 3],
  ];
  for (const [x, y, ww, hh] of groves) rect(obj, x, y, x + ww - 1, y + hh - 1, TILE.TREE);

  // 灌木
  for (const [x, y] of [[6, 9], [17, 9], [11, 6], [16, 6], [9, 13], [21, 13]] as [number, number][])
    obj[y][x] = TILE.BUSH;

  // 花（不挡路）
  for (const [x, y] of [
    [3, 9], [7, 13], [10, 9], [16, 13], [20, 9], [24, 9], [5, 12], [22, 12], [12, 3], [15, 16],
  ] as [number, number][])
    if (obj[y][x] === -1) obj[y][x] = TILE.FLOWER;

  // 沿路栅栏
  for (let x = 4; x <= 10; x++) if (obj[12][x] === -1) obj[12][x] = TILE.FENCE;
  for (let x = 17; x <= 23; x++) if (obj[12][x] === -1) obj[12][x] = TILE.FENCE;

  // 路牌
  obj[9][12] = TILE.SIGN;

  return {
    id: 'town',
    name: '青丘镇',
    ground,
    objects: obj,
    spawn: { x: 13, y: 14 },
    portals: [{ x: 0, y: 10, to: 'field', spawn: { x: 2, y: 13 } }],
  };
}

// ───────────────────── 野区：青丘野径 ─────────────────────
function buildField(): MapDef {
  const w = 36;
  const h = 26;
  const ground = grid(w, h, TILE.GRASS);
  const obj = grid(w, h, -1);
  const r = rng(31);

  // 野区地面用带碎草的变体
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) if (r() > 0.3) ground[y][x] = TILE.GRASS2;

  // 入口小路
  rect(ground, 0, 12, 7, 13, TILE.PATH);

  // 外围树林
  for (let x = 0; x < w; x++) {
    obj[0][x] = TILE.TREE;
    obj[h - 1][x] = TILE.TREE;
  }
  for (let y = 0; y < h; y++) {
    obj[y][0] = TILE.TREE;
    obj[y][w - 1] = TILE.TREE;
  }

  // 四大片树林，形成通道
  rect(obj, 10, 2, 18, 8, TILE.TREE);
  rect(obj, 22, 2, 30, 7, TILE.TREE);
  rect(obj, 12, 16, 22, 23, TILE.TREE);
  rect(obj, 26, 14, 33, 20, TILE.TREE);

  // 灌木
  for (const [x, y] of [
    [9, 10], [19, 12], [24, 10], [8, 16], [11, 11], [17, 15], [25, 11], [31, 9], [30, 22], [14, 10],
  ] as [number, number][])
    if (obj[y][x] === -1) obj[y][x] = TILE.BUSH;

  // 花
  for (let i = 0; i < 30; i++) {
    const x = 1 + Math.floor(r() * (w - 2));
    const y = 1 + Math.floor(r() * (h - 2));
    if (obj[y][x] === -1 && ground[y][x] === TILE.GRASS2) obj[y][x] = TILE.FLOWER;
  }

  return {
    id: 'field',
    name: '青丘野径',
    wild: true,
    ground,
    objects: obj,
    spawn: { x: 5, y: 12 },
    portals: [{ x: 0, y: 12, to: 'town', spawn: { x: 2, y: 10 } }],
  };
}

export const MAPS: Record<string, MapDef> = {
  town: buildTown(),
  field: buildField(),
};
