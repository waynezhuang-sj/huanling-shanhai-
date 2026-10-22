/** 图块编号（与 BootScene 里 drawTile 的顺序一致） */
export const TILE = {
  GRASS: 0,
  PATH: 1,
  TREE: 2,
  WATER: 3,
  WALL: 4,
  TALL: 5,
  FLOWER: 6,
  DOOR: 7,
} as const;

/** 走不过去的图块 */
export const SOLID = [TILE.TREE, TILE.WATER, TILE.WALL];

export interface Portal {
  x: number;
  y: number;
  to: string;
  spawn: { x: number; y: number };
}

export interface MapDef {
  id: string;
  name: string;
  data: number[][];
  spawn: { x: number; y: number };
  portals: Portal[];
}

function grid(w: number, h: number, fill: number): number[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

function border(g: number[][], t: number) {
  const h = g.length;
  const w = g[0].length;
  for (let x = 0; x < w; x++) {
    g[0][x] = t;
    g[h - 1][x] = t;
  }
  for (let y = 0; y < h; y++) {
    g[y][0] = t;
    g[y][w - 1] = t;
  }
}

function rect(g: number[][], x0: number, y0: number, x1: number, y1: number, t: number) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (g[y] && g[y][x] !== undefined) g[y][x] = t;
    }
  }
}

// ─────────────────────────── 城镇 ───────────────────────────
function buildTown(): MapDef {
  const w = 24;
  const h = 18;
  const g = grid(w, h, TILE.GRASS);
  border(g, TILE.TREE);

  // 横贯主路
  rect(g, 1, 9, 22, 10, TILE.PATH);
  // 纵向小路
  rect(g, 11, 1, 12, 16, TILE.PATH);

  // 房屋 A（医馆）—— 墙体 + 门
  rect(g, 4, 4, 8, 7, TILE.WALL);
  g[7][6] = TILE.DOOR;
  // 房屋 B（杂货铺）
  rect(g, 14, 4, 18, 7, TILE.WALL);
  g[7][16] = TILE.DOOR;

  // 点缀花与树
  const flowers: [number, number][] = [
    [2, 3], [3, 3], [20, 3], [21, 3], [2, 14], [21, 14], [9, 13], [14, 13],
  ];
  for (const [x, y] of flowers) g[y][x] = TILE.FLOWER;
  const trees: [number, number][] = [[2, 6], [21, 6], [2, 12], [21, 12], [6, 14], [17, 14]];
  for (const [x, y] of trees) g[y][x] = TILE.TREE;

  return {
    id: 'town',
    name: '青丘镇',
    data: g,
    spawn: { x: 11, y: 12 },
    portals: [{ x: 1, y: 9, to: 'field', spawn: { x: 2, y: 12 } }],
  };
}

// ─────────────────────────── 野区 ───────────────────────────
function buildField(): MapDef {
  const w = 32;
  const h = 24;
  const g = grid(w, h, TILE.GRASS);
  border(g, TILE.TREE);

  // 入口小路
  rect(g, 1, 12, 9, 12, TILE.PATH);

  // 高草区（三块）
  rect(g, 11, 4, 17, 9, TILE.TALL);
  rect(g, 12, 14, 19, 20, TILE.TALL);
  rect(g, 22, 6, 28, 12, TILE.TALL);

  // 池塘
  rect(g, 22, 16, 28, 21, TILE.WATER);

  // 零散树
  const trees: [number, number][] = [[10, 11], [20, 11], [21, 4], [19, 13], [29, 14]];
  for (const [x, y] of trees) g[y][x] = TILE.TREE;

  return {
    id: 'field',
    name: '青丘野径',
    data: g,
    spawn: { x: 8, y: 12 },
    portals: [{ x: 1, y: 12, to: 'town', spawn: { x: 2, y: 9 } }],
  };
}

export const MAPS: Record<string, MapDef> = {
  town: buildTown(),
  field: buildField(),
};
