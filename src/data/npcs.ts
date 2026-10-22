/** 城镇 NPC 定义：位置、形象、对话、角色功能 */
export interface NpcDef {
  id: string;
  name: string;
  map: string;
  x: number;
  y: number;
  /** 图集帧号（Tiny Dungeon 角色，132 + 索引） */
  frame: number;
  role: 'healer' | 'shop' | 'chat';
  lines: string[];
}

export const NPCS: NpcDef[] = [
  {
    id: 'healer',
    name: '巫医·青禾',
    map: 'town',
    x: 7,
    y: 6,
    frame: 219, // 老者
    role: 'healer',
    lines: [
      '旅者，你身上的灵息乱了。',
      '把神兽交给我吧，山里的草药还够用。',
    ],
  },
  {
    id: 'merchant',
    name: '货郎·石三',
    map: 'town',
    x: 21,
    y: 6,
    frame: 220, // 棕衣青年
    role: 'shop',
    lines: ['走过青丘野径的，都得备点灵草。', '看看要什么？'],
  },
  {
    id: 'villager',
    name: '浣衣女·阿桑',
    map: 'town',
    x: 12,
    y: 12,
    frame: 231, // 红发少女
    role: 'chat',
    lines: [
      '野径那头的林子，最近不太平。',
      '听说有人瞧见「讙」了 —— 白首狸身，叫声像榴榴。',
      '《北山经》里说，它可以御凶。可惜我是不敢靠近的。',
    ],
  },
];

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  desc: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'herb', name: '灵草', price: 20, desc: '战斗中回复 25 点体力' },
  { id: 'charm', name: '静心符', price: 45, desc: '战斗中解除混乱与减速' },
];
