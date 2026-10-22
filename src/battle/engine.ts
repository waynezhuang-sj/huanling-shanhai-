/**
 * 战斗引擎 —— 纯函数，无 Phaser 依赖，便于单测
 */
import { MOVES, SPECIES, type Element, type Move, typeMultiplier } from '../data/creatures';

export const MAX_LEVEL = 20;

export interface CreatureInst {
  uid: string;
  speciesId: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
}

let uidSeq = 0;

export function statsFor(speciesId: string, level: number) {
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error(`未知神兽: ${speciesId}`);
  return {
    maxHp: Math.floor(sp.base.hp + level * 3),
    atk: Math.floor(sp.base.atk + level * 1.2),
    def: Math.floor(sp.base.def + level * 1.0),
    spd: Math.floor(sp.base.spd + level * 1.0),
  };
}

export function createCreature(speciesId: string, level: number): CreatureInst {
  const s = statsFor(speciesId, level);
  return {
    uid: `c${++uidSeq}`,
    speciesId,
    level,
    exp: 0,
    hp: s.maxHp,
    maxHp: s.maxHp,
    atk: s.atk,
    def: s.def,
    spd: s.spd,
  };
}

export function expToNext(level: number): number {
  return level * 25;
}

/** 战利经验 */
export function expReward(enemyLevel: number): number {
  return 12 + enemyLevel * 10;
}

/** 加经验，返回升级次数 */
export function gainExp(c: CreatureInst, amount: number): number {
  let ups = 0;
  c.exp += amount;
  while (c.level < MAX_LEVEL && c.exp >= expToNext(c.level)) {
    c.exp -= expToNext(c.level);
    c.level += 1;
    ups += 1;
    const s = statsFor(c.speciesId, c.level);
    const ratio = c.hp / c.maxHp;
    c.maxHp = s.maxHp;
    c.atk = s.atk;
    c.def = s.def;
    c.spd = s.spd;
    c.hp = Math.max(1, Math.round(c.maxHp * ratio));
  }
  if (c.level >= MAX_LEVEL) c.exp = 0;
  return ups;
}

export interface DamageResult {
  damage: number;
  mult: number;
  label: '' | '克制' | '被克';
}

export function calcDamage(attacker: CreatureInst, defender: CreatureInst, move: Move): DamageResult {
  if (move.kind === 'heal') return { damage: 0, mult: 1, label: '' };
  const mult = typeMultiplier(move.element, SPECIES[defender.speciesId].element);
  const base =
    ((2 * attacker.level) / 5 + 2) * move.power * (attacker.atk / Math.max(1, defender.def)) / 50 + 2;
  const jitter = 0.9 + Math.random() * 0.1;
  const damage = Math.max(1, Math.floor(base * mult * jitter));
  return {
    damage,
    mult,
    label: mult > 1 ? '克制' : mult < 1 ? '被克' : '',
  };
}

export function healAmount(c: CreatureInst, move: Move): number {
  return Math.max(1, Math.floor(move.power + c.maxHp * 0.08));
}

export function movesOf(c: CreatureInst): Move[] {
  return SPECIES[c.speciesId].moves.map((id) => MOVES[id]);
}

export function elementOf(c: CreatureInst): Element {
  return SPECIES[c.speciesId].element;
}

export function nameOf(c: CreatureInst): string {
  return SPECIES[c.speciesId].name;
}

/** 从野区权重表随机一只 */
export function rollWild(table: readonly { species: string; weight: number; lv: readonly [number, number] }[]) {
  const total = table.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of table) {
    r -= e.weight;
    if (r <= 0) {
      const lv = e.lv[0] + Math.floor(Math.random() * (e.lv[1] - e.lv[0] + 1));
      return createCreature(e.species, lv);
    }
  }
  const e = table[table.length - 1];
  return createCreature(e.species, e.lv[0]);
}
