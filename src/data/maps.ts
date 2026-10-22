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
  PATH_NW: 12,
  PATH_N: 13,
  PATH_NE: 14,
  PATH_W: 24,
  PATH_E: 26,
  PATH_SW: 36,
  PATH_S: 37,
  PATH_SE: 38,
  PATH_IN_NW: 39,
  PATH_IN_NE: 40,
  PATH_IN_SW: 42,
  PATH_IN_SE: 41,

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
  // 原映射保留。52-55 实际是红屋顶上沿/天窗，不能再当墙面使用。
  ROOF_RED_CAP: [52, 53, 54],
  ROOF_RED_TILE: [64, 65, 66],
  ROOF_BLUE_CAP: [48, 49, 50],
  ROOF_BLUE_TILE: [60, 61, 62],
  WALL_RED: [72, 73, 75],
  WALL_BLUE: [76, 77, 79],
  WALL_WINDOW_RED: 84,
  WALL_WINDOW_BLUE: 88,
  WALL_DOOR_BLUE: 89,

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
  ...TILE.ROOF_RED_CAP,
  ...TILE.ROOF_RED_TILE,
  ...TILE.ROOF_BLUE_CAP,
  ...TILE.ROOF_BLUE_TILE,
  ...TILE.WALL_RED,
  ...TILE.WALL_BLUE,
  TILE.WALL_WINDOW_RED,
  TILE.WALL_WINDOW_BLUE,
  TILE.WALL_DOOR_BLUE,
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
  houses: { x: number; y: number; width: number; height: number }[];
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

/** 屋脊 + 两行瓦 + 檐口 + 两行墙；同色墙、窗、门按完整横排拼接。 */
function house(obj: number[][], x0: number, y0: number, w: number, blue = false) {
  const cap = blue ? TILE.ROOF_BLUE_CAP : TILE.ROOF_RED_CAP;
  const roof = blue ? TILE.ROOF_BLUE_TILE : TILE.ROOF_RED_TILE;
  const wall = blue ? TILE.WALL_BLUE : TILE.WALL_RED;
  for (let y = 0; y < 6; y++) {
    const tiles = y === 0 ? cap : y <= 3 ? roof : wall;
    for (let x = 0; x < w; x++) {
      obj[y0 + y][x0 + x] = tiles[x === 0 ? 0 : x === w - 1 ? 2 : 1];
    }
  }
  obj[y0 + 4][x0 + 1] = blue ? TILE.WALL_WINDOW_BLUE : TILE.WALL_WINDOW_RED;
  obj[y0 + 4][x0 + w - 2] = blue ? TILE.WALL_WINDOW_BLUE : TILE.WALL_WINDOW_RED;
  obj[y0 + 5][x0 + Math.floor(w / 2)] = blue ? TILE.WALL_DOOR_BLUE : TILE.DOOR;
  return { x: x0, y: y0, width: w, height: 6 };
}

/** 仅替换道路边界，中心继续使用已确认的干净土路 25；交叉口保留连通。 */
function edgePaths(ground: number[][]) {
  const path = ground.map((row) => row.map((tile) => tile === TILE.PATH));
  const has = (x: number, y: number) => path[y]?.[x] ?? false;
  path.forEach((row, y) => row.forEach((isPath, x) => {
    if (!isPath) return;
    const n = has(x, y - 1), s = has(x, y + 1);
    const w = has(x - 1, y), e = has(x + 1, y);
    ground[y][x] = !n ? (!w ? TILE.PATH_NW : !e ? TILE.PATH_NE : TILE.PATH_N)
      : !s ? (!w ? TILE.PATH_SW : !e ? TILE.PATH_SE : TILE.PATH_S)
      : !w ? TILE.PATH_W : !e ? TILE.PATH_E
      : !has(x - 1, y - 1) ? TILE.PATH_IN_NW
      : !has(x + 1, y - 1) ? TILE.PATH_IN_NE
      : !has(x - 1, y + 1) ? TILE.PATH_IN_SW
      : !has(x + 1, y + 1) ? TILE.PATH_IN_SE : TILE.PATH;
  }));
}

/** 一排连起来的栅栏 */
function fenceRow(obj: number[][], x0: number, x1: number, y: number) {
  for (let x = x0; x <= x1; x++) {
    obj[y][x] = x === x0 ? TILE.FENCE_L : x === x1 ? TILE.FENCE_R : TILE.FENCE_M;
  }
}

/** 连续树群：内部填满，边缘渐疏；完整树帧不变，同片以一种树为主。 */
function grove(
  obj: number[][],
  r: () => number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  const dominant = r() < 0.5 ? TILE.TREE_ROUND : TILE.TREE_LEAFY;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!obj[y] || obj[y][x] === undefined) continue;
      if (obj[y][x] !== -1) continue;
      const boundary = x === 0 || y === 0 || x === obj[0].length - 1 || y === obj.length - 1;
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      if (!boundary && edge && r() < 0.3) continue;
      obj[y][x] = r() < 0.85 ? dominant : TILE.TREE_ROUND2;
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

  // 六行建筑落到 y=5 为止，保留 y=6 的医馆 / 商店 NPC 与门前通道。
  const houses = [house(obj, 3, 0, 7), house(obj, 21, 0, 5, true)];

  // 外围树林
  grove(obj, r, 0, 0, w - 1, 1);
  grove(obj, r, 0, h - 3, w - 1, h - 1);
  grove(obj, r, 0, 0, 1, h - 1);
  grove(obj, r, w - 2, 0, w - 1, h - 1);

  // 镇内树丛
  grove(obj, r, 2, 9, 4, 10);
  grove(obj, r, 25, 9, 27, 10);
  grove(obj, r, 2, 17, 5, 19);
  grove(obj, r, 24, 17, 27, 19);

  // 小片树林替代单棵散点，保留路口与房屋前的通行空间。
  grove(obj, r, 9, 16, 11, 18);
  grove(obj, r, 19, 16, 21, 18);
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

  // ⭐ 西侧出口：打通 3 格高、4 格深的缺口（否则被树林封死，走不到传送点）
  for (let y = 10; y <= 12; y++) {
    for (let x = 0; x <= 3; x++) {
      obj[y][x] = -1;
      ground[y][x] = TILE.PATH;
    }
  }
  edgePaths(ground);

  return {
    id: 'town',
    name: '青丘镇',
    ground,
    objects: obj,
    houses,
    spawn: { x: 14, y: 15 },
    portals: [{ x: 1, y: 11, to: 'field', spawn: { x: 33, y: 13 } }],
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
  // 入口小路（东侧进入，往西通向腹地）
  rect(ground, w - 6, 12, w - 1, 14, TILE.PATH);

  // 外围树林
  grove(obj, r, 0, 0, w - 1, 2);
  grove(obj, r, 0, h - 3, w - 1, h - 1);
  grove(obj, r, 0, 0, 2, h - 1);
  grove(obj, r, w - 3, 0, w - 1, h - 1);

  // 四片树林围出通道
  grove(obj, r, 11, 2, 19, 8);
  grove(obj, r, 23, 2, 31, 7);
  grove(obj, r, 13, 17, 23, 25);
  grove(obj, r, 27, 15, 35, 21);

  // 树群边缘小片延伸，避开入口通道。
  grove(obj, r, 18, 10, 20, 12);
  grove(obj, r, 29, 9, 32, 11);

  // 小草 / 蘑菇 / 花
  for (let i = 0; i < 18; i++) {
    const x = 1 + Math.floor(r() * (w - 2));
    const y = 1 + Math.floor(r() * (h - 2));
    if (obj[y][x] === -1) obj[y][x] = TILE.FLOWER;
  }
  obj[9][14] = TILE.MUSHROOM;
  obj[20][29] = TILE.MUSHROOM;

  // ⭐ 东侧入口：从镇上往西走 → 应从野区「东边」进入（地理方向连贯）
  for (let y = 12; y <= 14; y++) {
    for (let x = w - 5; x <= w - 1; x++) {
      obj[y][x] = -1;
      ground[y][x] = TILE.PATH;
    }
  }
  // 东入口向内引一条小路，接入腹地
  for (let x = 18; x <= w - 5; x++) {
    for (let y = 12; y <= 14; y++) {
      if (obj[y][x] !== -1) continue;
      ground[y][x] = TILE.PATH;
    }
  }

  // 西侧留一条死路小径（不设传送点，纯地形，避免玩家误以为能出去）
  for (let y = 11; y <= 13; y++) {
    for (let x = 0; x <= 3; x++) {
      obj[y][x] = TREES[Math.floor(r() * TREES.length)];
    }
  }

  edgePaths(ground);

  return {
    id: 'field',
    name: '青丘野径',
    wild: true,
    ground,
    objects: obj,
    houses: [],
    spawn: { x: 18, y: 13 },
    portals: [{ x: w - 2, y: 13, to: 'town', spawn: { x: 3, y: 11 } }],
  };
}

export const MAPS: Record<string, MapDef> = {
  town: buildTown(),
  field: buildField(),
};
