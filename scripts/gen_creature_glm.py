#!/usr/bin/env python3
"""用 GLM(Z.AI) CogView 生成神兽图。密钥从 ~/.hermes/.env 读取，不落盘不外传。"""
import base64
import json
import os
import pathlib
import sys
import urllib.request

ENV = pathlib.Path.home() / ".hermes" / ".env"


def load_env() -> dict:
    env = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


BASE_PROMPT = (
    "中式工笔风格的神兽插画，墨线勾勒轮廓，石青石绿与朱砂设色，低饱和。"
    "全身居中，侧身或四分之三视角，纯白背景，无阴影无地面，无文字无边框。"
    "轮廓清晰，细节不要过碎。主体："
)


def gen(prompt: str, out: pathlib.Path, size: str = "1024x1024", model: str = "cogview-3-flash") -> bool:
    env = load_env()
    key = env.get("GLM_API_KEY")
    if not key:
        print("缺少 GLM_API_KEY")
        return False
    base = env.get("GLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4").rstrip("/")
    url = f"{base}/images/generations"
    body = json.dumps({"model": model, "prompt": BASE_PROMPT + prompt, "size": size}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:300]}")
        return False

    try:
        item = data["data"][0]
        if item.get("url"):
            with urllib.request.urlopen(item["url"], timeout=180) as resp:
                out.write_bytes(resp.read())
        else:
            out.write_bytes(base64.b64decode(item["b64_json"]))
        print(f"OK -> {out}")
        return True
    except Exception as e:
        print("解析失败:", e, str(data)[:300])
        return False


if __name__ == "__main__":
    prompt = sys.argv[1] if len(sys.argv) > 1 else "一只白色的马形神兽，头是白色的"
    model = sys.argv[2] if len(sys.argv) > 2 else "cogview-4"
    out = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else pathlib.Path("/tmp/hl-shots/gen_test.png")
    print(gen(prompt, out, model=model))
