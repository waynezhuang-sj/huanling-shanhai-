# MVP 图片素材来源与授权

> 2026-10-22 地形更新：当前 `tiles.png`、地形 `contact_sheet.png` 以及运行图集的替换区域来自本次内置 imagegen 原画及后处理，**不适用下文旧版地形的 Kenney/程序化绘图来源和 CC0 声明**。本次生成内容未新增 CC0 授权声明。完整提示词、逐帧来源、迭代和限制见 [美术说明](../../../docs/美术说明.md) 及 `aesthetic/`。下文保留为旧版素材的来源记录；其他素材本次未修改，不重新核实其历史来源。

所有交付图片及其程序化新增部分采用 **CC0 1.0 Universal**，允许商用、修改和再分发。未使用任天堂、宝可梦或来源不明的图片。字体仅用于 contact sheet 的验收标签，不包含字体文件。

| 文件 / 素材套装 | 来源链接 | 授权 | 修改说明 |
| --- | --- | --- | --- |
| tiles.png / Tiny Town 1.1 | [Kenney 官方页面](https://kenney.nl/assets/tiny-town) | CC0-1.0 | 从原包的 Tiles/tile_NNNN.png 裁剪重排；新增水纹、花、石头、木箱；统一到 15 个不透明颜色 + 透明色。 |
| hero.png / Tiny Dungeon 1.0 + 程序化人物 | [Kenney 官方页面](https://kenney.nl/assets/tiny-dungeon)；[本地生成源文件](./_generate.py) | CC0-1.0 | 原包 tile_0086 的头部裁剪作为基础；PIL 绘制衣服、方向头部、背包、三种步态，扩展为 16×24；统一调色板。 |
| npc.png / Tiny Dungeon 1.0 + 程序化人物 | [Kenney 官方页面](https://kenney.nl/assets/tiny-dungeon)；[本地生成源文件](./_generate.py) | CC0-1.0 | 巫医/货郎/浣衣女分别基于 tile_0100/0086/0099 头部；新增白发胡须与手杖、货包、辫子围裙和洗衣布；16×24。 |
| creatures.png / 山海神兽程序化像素图 | [本地原创生成源文件](./_generate.py)；[CC0 许可](https://creativecommons.org/publicdomain/zero/1.0/) | CC0-1.0 | 未找到与指定形象相符且可验证授权的 CC0 成套图，使用 PIL 原创绘制。鹿蜀为白首马身、虎纹赤尾；赤鱬为人面赤鱼；讙为白首独目狸形；石魅为无眼山石。均朝左、有深色描边和至少 4px 透明边距。 |
| ui.png / UI Pack - Pixel Adventure 2.0 | [Kenney 官方页面](https://kenney.nl/assets/ui-pack-pixel-adventure)；[本地生成源文件](./_generate.py) | CC0-1.0 | 使用 Small tiles/Thick outline 中 tile_0012 对话框、0010 按钮、0013 血条底、0000 底盘、0001 摇杆头；裁透明边、九宫格拉伸或最近邻缩放；血条填充用 PIL 绘制；统一调色板。 |
| contact_sheet.png | 上述全部图片及本地生成脚本 | CC0-1.0（图片内容） | 最近邻放大、透明棋盘格背景、添加英文语义键和从零开始的索引。预览字形由系统 Arial（不可用时 Pillow 默认字体）栅格化，仅作验收标注。 |

程序化新增的图片部分在此以 CC0 1.0 Universal 贡献。全部 CC0 法律文本见 [sources/CC0-1.0.txt](./sources/CC0-1.0.txt)，该文本取自 [SPDX 许可列表的 CC0-1.0 原文](https://github.com/spdx/license-list-data/blob/main/text/CC0-1.0.txt)（Creative Commons 法律文本下载返回 403，改用此镜像）。三个官方 ZIP 原包及随包许可文本（仅规范换行与末尾空白，原始字节保留在 ZIP 内）保留在 sources/；页面、直接下载 URL 和 ZIP SHA-256 记录在 [sources/provenance.json](./sources/provenance.json)。

## tiles.png 逐帧来源

数字为 Tiny Town 原包 `Tiles/tile_NNNN.png` 的编号；“原创”为 `_generate.py` 中的 PIL 图元。

| 输出索引 | 原包编号 / 处理 |
| --- | --- |
| 0–5 | 0, 1, 2, 25, 24, 26 |
| 6–7 | 原创水面与水纹 |
| 8–13 | 5, 4, 3, 28, 17, 16 |
| 14 | 原创花朵 |
| 15 | 29 |
| 16–17 | 原创两种石头 |
| 18–31 | 52, 53, 54, 72, 73, 75, 74, 85, 84, 88, 44, 45, 46, 83 |
| 32 | 原创木箱 |

## 授权核实与检索范围

已读取以上三个 Kenney 官方页面及 ZIP 随包 License.txt，均为 CC0。对 OpenGameArt 上的 lushu / shan hai 定向检索未找到可验证且符合规格的四兽素材；Tiny Dungeon 原包只有正面人物，因此方向与步态按规格程序化补画。未将第三方搜索摘要当作图片授权。
