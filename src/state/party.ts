/**
 * 队伍状态（内存态；M5 接存档时再序列化到 localStorage）
 */
import { createCreature, type CreatureInst } from '../battle/engine';

export const party: CreatureInst[] = [
  createCreature('lushu', 5),
  createCreature('chiru', 4),
];

let activeIdx = 0;

export function getActiveIdx(): number {
  return activeIdx;
}

export function getActive(): CreatureInst {
  return party[activeIdx];
}

export function setActive(idx: number): void {
  if (idx >= 0 && idx < party.length) activeIdx = idx;
}

/** 下一个还活着的成员下标，没有则 -1 */
export function nextAlive(fromIdx: number): number {
  for (let i = 0; i < party.length; i++) {
    const idx = (fromIdx + 1 + i) % party.length;
    if (party[idx].hp > 0) return idx;
  }
  return -1;
}

export function aliveCount(): number {
  return party.filter((c) => c.hp > 0).length;
}

export function healAll(): void {
  for (const c of party) c.hp = c.maxHp;
}

// ── 钱包与背包 ──
export const wallet = { coins: 120 };

export interface BagItem {
  id: string;
  count: number;
}

export const bag: BagItem[] = [{ id: 'herb', count: 2 }];

export function addItem(id: string, n = 1): void {
  const it = bag.find((b) => b.id === id);
  if (it) it.count += n;
  else bag.push({ id, count: n });
}

export function countItem(id: string): number {
  return bag.find((b) => b.id === id)?.count ?? 0;
}

/** 战斗胜利后是否有成员升级（返回描述） */
export function levelUpTexts(names: string[], ups: number[]): string[] {
  const out: string[] = [];
  names.forEach((n, i) => {
    if (ups[i] > 0) out.push(`${n} 升到 Lv.${party[i].level}！`);
  });
  return out;
}
