/**
 * 神兽 / 技能 / 五行相克 —— 纯数据层
 */

export type Element = '金' | '木' | '水' | '火' | '土';
export const ELEMENTS: Element[] = ['金', '木', '水', '火', '土'];

/** 相克倍率：攻方 → 守方 */
export const CHART: Record<Element, Record<Element, number>> = {
  金: { 金: 0.75, 木: 1.5, 水: 1.0, 火: 0.75, 土: 1.0 },
  木: { 金: 0.75, 木: 0.75, 水: 1.0, 火: 1.0, 土: 1.5 },
  水: { 金: 1.0, 木: 1.0, 水: 0.75, 火: 1.5, 土: 0.75 },
  火: { 金: 1.5, 木: 1.0, 水: 0.75, 火: 0.75, 土: 1.0 },
  土: { 金: 1.0, 木: 0.75, 水: 1.5, 火: 1.0, 土: 0.75 },
};

export function typeMultiplier(atk: Element, def: Element): number {
  return CHART[atk][def];
}

export interface Move {
  id: string;
  name: string;
  element: Element;
  power: number;
  /** heal = 回复自身血量，不造成伤害 */
  kind: 'damage' | 'heal';
  desc: string;
}

export const MOVES: Record<string, Move> = {
  // 鹿蜀（木）
  leaf_blade: { id: 'leaf_blade', name: '叶刃', element: '木', power: 42, kind: 'damage', desc: '木属性，锐利叶片' },
  root_bind: { id: 'root_bind', name: '根缚', element: '木', power: 30, kind: 'damage', desc: '木属性，缠住对手' },
  beast_rush: { id: 'beast_rush', name: '兽突', element: '土', power: 36, kind: 'damage', desc: '土属性，正面冲撞' },
  spring_breath: { id: 'spring_breath', name: '回春', element: '木', power: 22, kind: 'heal', desc: '回复自身体力' },

  // 赤鱬（水）
  water_jet: { id: 'water_jet', name: '水溅', element: '水', power: 40, kind: 'damage', desc: '水属性，高压水珠' },
  tide_surge: { id: 'tide_surge', name: '潮涌', element: '水', power: 58, kind: 'damage', desc: '水属性，大浪压来' },
  scale_cut: { id: 'scale_cut', name: '鳞切', element: '金', power: 34, kind: 'damage', desc: '金属性，鱼鳞如刃' },
  moisten: { id: 'moisten', name: '润泽', element: '水', power: 24, kind: 'heal', desc: '回复自身体力' },

  // 讙（火）
  flame_tongue: { id: 'flame_tongue', name: '火舌', element: '火', power: 44, kind: 'damage', desc: '火属性，舔舐般的火' },
  wildfire: { id: 'wildfire', name: '燎原', element: '火', power: 62, kind: 'damage', desc: '火属性，大范围燃烧' },
  ram: { id: 'ram', name: '蛮撞', element: '土', power: 38, kind: 'damage', desc: '土属性，兽身硬撞' },
  ember_guard: { id: 'ember_guard', name: '烈息', element: '火', power: 20, kind: 'heal', desc: '回复自身体力' },

  // 石魅（土）
  rock_throw: { id: 'rock_throw', name: '投石', element: '土', power: 38, kind: 'damage', desc: '土属性，碎石砸击' },
  earth_spike: { id: 'earth_spike', name: '地刺', element: '土', power: 50, kind: 'damage', desc: '土属性，尖石破土' },
  gold_edge: { id: 'gold_edge', name: '金边', element: '金', power: 34, kind: 'damage', desc: '金属性，锐利矿刃' },
  stone_sleep: { id: 'stone_sleep', name: '石眠', element: '土', power: 21, kind: 'heal', desc: '回复自身体力' },
};

export interface Species {
  id: string;
  name: string;
  element: Element;
  /** 图集帧号 */
  frame: number;
  base: { hp: number; atk: number; def: number; spd: number };
  moves: string[];
  lore: string;
}

export const SPECIES: Record<string, Species> = {
  lushu: {
    id: 'lushu',
    name: '鹿蜀',
    element: '木',
    frame: 0,
    base: { hp: 24, atk: 9, def: 9, spd: 9 },
    moves: ['leaf_blade', 'root_bind', 'beast_rush', 'spring_breath'],
    lore: '《南山经》：其状如马而白首，其文如虎而赤尾，其音如谣。',
  },
  chiru: {
    id: 'chiru',
    name: '赤鱬',
    element: '水',
    frame: 1,
    base: { hp: 20, atk: 8, def: 7, spd: 14 },
    moves: ['water_jet', 'tide_surge', 'scale_cut', 'moisten'],
    lore: '《南山经》：其状如鱼而人面，其音如鸳鸯，食之不疥。',
  },
  huan: {
    id: 'huan',
    name: '讙',
    element: '火',
    frame: 2,
    base: { hp: 22, atk: 13, def: 8, spd: 6 },
    moves: ['flame_tongue', 'wildfire', 'ram', 'ember_guard'],
    lore: '《北山经》：其状如狸而白首，其音如榴榴，可以御凶。',
  },
  shimei: {
    id: 'shimei',
    name: '石魅',
    element: '土',
    frame: 3,
    base: { hp: 26, atk: 10, def: 12, spd: 5 },
    moves: ['rock_throw', 'earth_spike', 'gold_edge', 'stone_sleep'],
    lore: '山石久聚成精，性迟而坚，力大难撼。',
  },
};

/** 野区可能遇到的对手 */
export const WILD_TABLE = [
  { species: 'shimei', weight: 4, lv: [2, 4] },
  { species: 'huan', weight: 3, lv: [2, 4] },
  { species: 'chiru', weight: 3, lv: [2, 3] },
  { species: 'lushu', weight: 2, lv: [2, 3] },
] as const;
