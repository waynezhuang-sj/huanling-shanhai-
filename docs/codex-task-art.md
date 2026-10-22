# Codex 任务：提升《唤灵山海》美术表现

> 用途：交给 Codex（Mac 本机 / 桌面版）执行。本文件是任务书，可反复使用。

---

## 一、项目与环境

| 项 | 值 |
|---|---|
| 仓库 | `git@github.com:waynezhuang-sj/h...` |
| 本地路径 | `/Users/ryan/code/huanling-shanhai` |
| 技术栈 | Phaser 3 + TypeScript + Vite |
| 构建 | `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json && node ./node_modules/vite/bin/vite.js build` |
| 本地预览 | `cd dist && python3 -m http.server 4173 --bind 127.0.0.1` |
| 截图验证 | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=960,640 --virtual-time-budget=12000 --screenshot=/tmp/shot.png "http://127.0.0.1:4173/"` |
| 线上 | https://waynezhuang-sj.github.io/huanling-shanhai-/ （push 后自动部署） |
| 网络 | 需要代理：`export HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890` |
| **沙箱** | **必须 `-s danger-full-access`**。`workspace-write` 下 macOS Seatbelt 会拦「绑定端口」和「启动 GUI 应用」，导致 http.server 报 `Operation not permitted`、Chrome 退出码 134 |

## 二、当前实现（不要推翻）

- `public/assets/atlas.png`：264 帧、每帧 16×16、12 列
  - 帧 0-131 = Kenney Tiny Town
  - 帧 132-263 = Kenney Tiny Dungeon
  - 授权 CC0 1.0，见 `public/assets/CREDITS.txt`
- `src/data/maps.ts`：`TILE` 常量表 + 程序化生成地图（`ground` 地面层 / `objects` 物件层，`-1` 为空）
- `src/scenes/OverworldScene.ts`：双层 tilemap、碰撞、镜头跟随、地图传送、触屏摇杆
- `src/scenes/BootScene.ts`：加载 spritesheet
- `src/scenes/UIScene.ts`：地图名 + 操作提示

## 三、要解决的问题（用户原话）

1. 「房子混乱」
2. 「树很丑」
3. 「栏杆也没接上」
4. 「主角没腿看起来怪怪的」（已换成有腿角色，需确认观感）

## 四、目标

把画面从「能看」做到「像个正经像素 RPG」。**只改美术与地图表现，不动玩法逻辑。**

## 五、允许的两条路线（自行判断，说明理由）

### 路线 A：同一图集内规范化
- 屋顶做**多层**（屋脊 + 2 行瓦 + 檐口）
- 道路做**带边**（中间 + 左右边缘 tile，避免整片纯色）
- 树林做**成片**（2-3 行密度 + 边缘渐疏），不要单棵散点
- 房屋做 2-3 种不同尺寸/配色，不要两栋一模一样的镜像
- 给树、房子、栅栏加**投影**（半透明深色椭圆/矩形）
- 水面/石地等增加材质变化

### 路线 B：引入更密的图集
- 若判断 Kenney 上限不足，可引入 **CC0 或 CC-BY** 的 32×32 图集（需在 CREDITS.txt 写清来源与授权）
- 必须在任务汇报中说明：为什么换、换的代价（帧号映射、地图重排、缩放）

**不接受**：使用任天堂/宝可梦或任何未经授权的素材。

## 六、硬性验收标准

1. **必须实际渲染截图**，不能用"应该没问题"代替。每轮改动后出图，自己先看，确认无黑底、无错位、无怪块。
2. **不得破坏已有功能**：行走、碰撞、地图切换、触屏摇杆、UI 必须仍然可用（截图 + 说明）。
3. `tsc --noEmit` 必须零错误，`vite build` 必须成功。
4. 改动完成 → 更新 `README.md` 的截图说明 → `git add/commit/push`，等 Actions 部署成功再汇报。
5. 汇报里必须包含：改了哪些文件、每处改动解决了哪个问题、截图路径、还有哪些没解决。

## 七、不要做的事

- 不要改战斗/存档/玩法逻辑（还没做）
- 不要扩大地图尺寸或新增关卡
- 不要提交 `node_modules`、`dist`
- 不要在没出图的情况下声称"美术已改善"

---

## 八、建议的执行顺序

1. 先跑一次构建 + 截图，建立当前基线（`/tmp/before.png`）
2. 按路线 A 做 3 处最明显的改动：屋顶点缀、道路带边、树林成片
3. 出图对比 `before` / `after`，自查
4. 若仍不满意，再评估路线 B
5. push 并等部署完成
