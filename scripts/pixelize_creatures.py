#!/usr/bin/env python3
"""
把 Codex imagegen 的高清神兽插画转成 64x64 像素立绘：
去白底 -> 裁切居中 -> 降采样 -> 量化到青绿调色板 -> 加墨线描边 -> 拼 2x2 图集
"""
from PIL import Image, ImageDraw, ImageFilter
import pathlib

SRC = {
    "lushu": pathlib.Path("/tmp/hl-shots/codex_lushu.png"),
    "chiru": pathlib.Path("/tmp/hl-shots/codex_chiru.png"),
    "huan": pathlib.Path("/tmp/hl-shots/codex_huan.png"),
    "shimei": pathlib.Path("/tmp/hl-shots/codex_shimei.png"),
}
OUT = pathlib.Path("/Users/ryan/code/huanling-shanhai/public/assets/mvp/creatures.png")
CELL = 64
PAD = 2

PALETTE = [
    (0x1b, 0x24, 0x26), (0x2c, 0x3a, 0x3d), (0x33, 0x4d, 0x46), (0x46, 0x63, 0x55),
    (0x5c, 0x7a, 0x62), (0x7a, 0x94, 0x74), (0x9a, 0xab, 0x86), (0x2f, 0x5d, 0x7a),
    (0x43, 0x78, 0x9b), (0x76, 0xa3, 0xb8), (0x8f, 0x46, 0x33), (0xb8, 0x6a, 0x4e),
    (0x8c, 0x7a, 0x5e), (0xb9, 0xae, 0x9a), (0xd3, 0xc9, 0xb2), (0xe8, 0xe0, 0xcc),
]


def cut_white(img: Image.Image, thresh: int = 238) -> Image.Image:
    """白底转透明（带羽化，避免锯齿）"""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > thresh and g > thresh and b > thresh:
                px[x, y] = (r, g, b, 0)
    return img


def crop_content(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def palette_img() -> Image.Image:
    p = Image.new("P", (16, 1))
    flat = []
    for c in PALETTE:
        flat.extend(c)
    p.putpalette(flat + [0, 0, 0] * (256 - 16))
    return p


def pixelize(img: Image.Image) -> Image.Image:
    img = cut_white(img)
    img = crop_content(img)

    # 等比缩放进 CELL-2*PAD 内
    inner = CELL - PAD * 2
    w, h = img.size
    scale = min(inner / w, inner / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    small = img.resize((nw, nh), Image.LANCZOS)

    # 量化到青绿调色板（保留 alpha）
    alpha = small.getchannel("A").point(lambda v: 255 if v > 110 else 0)
    q = small.convert("RGB").quantize(palette=palette_img(), dither=Image.Dither.NONE).convert("RGB")
    small = q.convert("RGBA")
    small.putalpha(alpha)

    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    canvas.paste(small, ((CELL - nw) // 2, (CELL - nh) // 2))

    # 墨线描边：alpha 边缘外扩 1px 填墨色
    a = canvas.getchannel("A")
    dilated = a.filter(ImageFilter.MaxFilter(3))
    edge = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    ep = edge.load()
    ap = a.load()
    dp = dilated.load()
    for y in range(CELL):
        for x in range(CELL):
            if dp[x, y] > 0 and ap[x, y] == 0:
                ep[x, y] = (0x1b, 0x24, 0x26, 255)
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    out.alpha_composite(edge)
    out.alpha_composite(canvas)
    return out


def main() -> None:
    sheet = Image.new("RGBA", (CELL * 2, CELL * 2), (0, 0, 0, 0))
    cells = []
    for i, (name, path) in enumerate(SRC.items()):
        img = pixelize(Image.open(path))
        cells.append((name, img))
        sheet.paste(img, ((i % 2) * CELL, (i // 2) * CELL))
    sheet.save(OUT)
    print("wrote", OUT, sheet.size)

    # 预览：深色底 + 4 倍放大
    preview = sheet.resize((CELL * 2 * 4, CELL * 2 * 4), Image.NEAREST)
    bg = Image.new("RGBA", (preview.size[0], preview.size[1] + 40), (0x1b, 0x24, 0x26, 255))
    bg.alpha_composite(preview, (0, 20))
    bg.save("/tmp/hl-shots/creature_pixel_preview.png")
    print("preview -> /tmp/hl-shots/creature_pixel_preview.png")


if __name__ == "__main__":
    main()
