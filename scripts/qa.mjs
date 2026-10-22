// 摇杆 / 传送 自动化验证：用 Node 内置 WebSocket 驱动 Chrome DevTools，无第三方依赖
const CDP_PORT = 9222;
const URL = process.env.TEST_URL || 'http://127.0.0.1:4173/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('CDP 未就绪');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, 20000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error('JS: ' + JSON.stringify(r.exceptionDetails.text));
    return r.result.value;
  }
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
}

(async () => {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  const cdp = new CDP(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  // 关键：必须在页面加载前开启触摸模拟，否则 Phaser 启动时判定为"无触摸设备"
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 960,
    height: 640,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.send('Page.navigate', { url: URL });
  await sleep(2500);

  // 等游戏就绪
  for (let i = 0; i < 40; i++) {
    const ready = await cdp.eval('!!(window.__game && window.__game.scene.getScene("Overworld"))');
    if (ready) break;
    await sleep(250);
  }

  const scene = 'window.__game.scene.getScene("Overworld")';
  check('游戏场景就绪', await cdp.eval(`!!${scene}`));

  // ── 触摸摇杆 ──
  await cdp.eval(`(()=>{const s=${scene}; s.player.setPosition(240,232); return true;})()`);
  const x0 = await cdp.eval(`${scene}.player.x`);

  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 700, y: 300, radiusX: 5, radiusY: 5, force: 1 }],
  });
  await sleep(80);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 760, y: 300, radiusX: 5, radiusY: 5, force: 1 }],
  });
  await sleep(900);
  const x1 = await cdp.eval(`${scene}.player.x`);
  const vBefore = await cdp.eval(`JSON.stringify(${scene}.virtual)`);

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  const vAfter = await cdp.eval(`JSON.stringify(${scene}.virtual)`);

  check('触摸拖动使角色右移', x1 > x0 + 8, `x ${x0.toFixed(1)} → ${x1.toFixed(1)}`);
  check('拖动时方向非零', vBefore !== '{"x":0,"y":0}', vBefore);
  check('松手后方向归零', vAfter === '{"x":0,"y":0}', vAfter);

  // ── 传送：镇 → 野区 ──
  await cdp.eval(`(()=>{const s=${scene}; s.scene.restart({mapId:"town", spawn:{x:3,y:11}}); return true;})()`);
  await sleep(1200);
  check('回到城镇', (await cdp.eval(`${scene}.mapId`)) === 'town');
  const p0 = await cdp.eval(`JSON.stringify({x:${scene}.player.x,y:${scene}.player.y})`);
  // 向西走出传送点（先离开，再进入）
  await cdp.eval(`(()=>{const s=${scene}; s.player.setPosition(80,184); return true;})()`); // 离开传送区
  await sleep(300);
  await cdp.eval(`(()=>{const s=${scene}; s.player.setPosition(24,184); return true;})()`); // 踩到传送点
  await sleep(1500);
  const mapAfter = await cdp.eval(`${scene}.mapId`);
  check('走到镇西出口 → 进入野区', mapAfter === 'field', `mapId=${mapAfter}`);

  const sp = await cdp.eval(`JSON.stringify({x:${scene}.player.x,y:${scene}.player.y})`);
  check('野区落点远离回城点', await cdp.eval(`(()=>{const s=${scene};const p=s.mapDef.portals[0];return Math.abs(s.player.x-(p.x*16+8))>32;})()`), sp);

  // ── 传送：野区 → 镇 ──
  await cdp.eval(`(()=>{const s=${scene}; const p=s.mapDef.portals[0]; s.player.setPosition((p.x-4)*16+8,(p.y)*16+8); return true;})()`);
  await sleep(400);
  await cdp.eval(`(()=>{const s=${scene}; const p=s.mapDef.portals[0]; s.player.setPosition(p.x*16+8,p.y*16+8); return true;})()`);
  await sleep(1500);
  check('走到野区东出口 → 回到城镇', (await cdp.eval(`${scene}.mapId`)) === 'town');

  // ── 无运行时报错 ──
  const errBox = await cdp.eval(`!!document.getElementById('errbox')`);
  check('无运行时报错浮层', errBox === false);

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n结果: ${pass}/${results.length} 通过`);
  if (pass !== results.length) process.exitCode = 1;
  ws.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
