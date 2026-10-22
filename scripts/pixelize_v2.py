#!/usr/bin/env python3
"""
神兽像素化 v2 —— 先把细节降到低分辨率，再整数倍放大，得到干净的粗像素。
对比三档颗粒：64(细) / 32→64(中) / 24→64(粗)
"""
from PIL import Image, ImageFilter
import pathlib

SRC = {
    "lushu": "/tmp/hl-shots/codex_lushu.png",
    "chiru": "/tmp/hl-shots/codex_chiru.png",
    "huan": "/tmp/hl-shots/codex_huan.png",
    "shimei": "/tmp/hl-shots/codex_shimei.png",
}
CELL = 64
PAD = 2
INK = (0x1b, 0x24, 0x26)

# 收窄到 10 色，减少杂色
PALETTE = [
    (0x1b, 0x24, 0x26),  # 墨
    (0x33, 0x4d, 0x46),  # 深苔绿
    (0x46, 0x63, 0x55),  # 苔绿
    (0x7a, 0x94, 0x74),  # 石绿浅
    (0x2f, 0x5d, 0x7a),  # 石青深
    (0x76, 0xa3, 0xb8),  # 石青浅
    (0x8f, 0x46, 0x33),  # 朱砂深
    (0xb8, 0x6a, 0x4e),  # 朱砂
    (0x8c, 0x7a, 0x5e),  # 赭石
    (0x8a, 0x86, 0x7c),  # 中性中灰
    (0xb5, 0xb0, 0xa4),  # 中性浅灰
    (0xd3, 0xc9, 0xb2),  # 米白
    (0xef, 0xe9, 0xdb),  # 近白
]


def palette_img() -> Image.Image:
    p = Image.new("P", (len(PALETTE), 1))
    flat = []
    for c in PALETTE:
        flat.extend(c)
    p.putpalette(flat + [0, 0, 0] * (256 - len(PALETTE)))
    return p


def cut_white(img: Image.Image, thresh: int = 236) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > thresh and g > thresh and b > thresh:
                px[x, y] = (0, 0, 0, 0)
    return img


def crop_content(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img



def despeckle(img: Image.Image) -> Image.Image:
    """去掉孤立单像素杂点：与四邻都不同的像素改为邻居主色。"""
    from collections import Counter
    w, h = img.size
    px = img.load()
    out = img.copy()
    op = out.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            neigh = [px[x - 1, y], px[x + 1, y], px[x, y - 1], px[x, y + 1]]
            neigh = [n for n in neigh if n[3] > 0]
            if not neigh:
                continue
            if all(n[:3] != (r, g, b) for n in neigh):
                c = Counter(n[:3] for n in neigh).most_common(1)[0][0]
                op[x, y] = (*c, a)
    return out

def outline(canvas: Image.Image) -> Image.Image:
    a = canvas.getchannel("A")
    dil = a.filter(ImageFilter.MaxFilter(3))
    edge = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ep, ap, dp = edge.load(), a.load(), dil.load()
    for y in range(canvas.size[1]):
        for x in range(canvas.size[0]):
            if dp[x, y] > 0 and ap[x, y] == 0:
                ep[x, y] = (*INK, 255)
    out = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    out.alpha_composite(edge)
    out.alpha_composite(canvas)
    return out


def pixelize(path: str, src_res: int, smooth: bool = True) -> Image.Image:
    img = crop_content(cut_white(Image.open(path)))
    if smooth:
        img = img.filter(ImageFilter.MedianFilter(5))  # 先抹掉细碎笔触
    inner = CELL - PAD * 2
    w, h = img.size
    scale = min(inner / w, inner / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))

    # 关键：先降到 src_res 分辨率（细节在这里被压掉）
    small = img.resize((max(1, src_res), max(1, round(src_res * nh / nw))), Image.BOX)
    alpha = small.getchannel("A").point(lambda v: 255 if v > 120 else 0)
    q = small.convert("RGB").quantize(palette=palette_img(), dither=Image.Dither.NONE).convert("RGB")
    small = q.convert("RGBA")
    small.putalpha(alpha)
    small = despeckle(small)

    # 整数倍放大回目标尺寸（NEAREST 保持方块像素）
    # 目标显示尺寸 = 64-2*PAD 内等比
    disp_w = inner
    disp_h = max(1, round(inner * nh / nw))
    up = small.resize((disp_w, disp_h), Image.NEAREST)

    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    canvas.paste(up, ((CELL - disp_w) // 2, (CELL - disp_h) // 2))
    return outline(canvas)


def main() -> None:
    # 最终采用 32 档（线条简化、无杂点、形象可辨）
    FINAL_RES = 32
    FINAL = pathlib.Path("/Users/ryan/code/huanling-shanhai/public/assets/mvp/creatures.png")
    sheet = Image.new("RGBA", (CELL * 2, CELL * 2), (0, 0, 0, 0))
    for i, (name, path) in enumerate(SRC.items()):
        sheet.paste(pixelize(path, FINAL_RES), ((i % 2) * CELL, (i // 2) * CELL))
    sheet.save(FINAL)
    print("wrote", FINAL, sheet.size, f"(grain={FINAL_RES})")

    rows = []
    for label, res in [("64 细", 60), ("32 中", 32), ("24 粗", 24)]:
        row = Image.new("RGBA", (CELL * 4, CELL), (0, 0, 0, 0))
        for i, (name, path) in enumerate(SRC.items()):
            row.paste(pixelize(path, res), (i * CELL, 0))
        rows.append((label, row))

    total_h = CELL * len(rows) + 8 * (len(rows) - 1)
    sheet2 = Image.new("RGBA", (CELL * 4, total_h), (0x1b, 0x24, 0x26, 255))
    y = 0
    for label, row in rows:
        sheet2.alpha_composite(row, (0, y))
        y += CELL + 8
    big = sheet2.resize((sheet2.size[0] * 3, sheet2.size[1] * 3), Image.NEAREST)
    big.save("/tmp/hl-shots/creature_grain_compare.png")
    print("compare -> /tmp/hl-shots/creature_grain_compare.png")


if __name__ == "__main__":
    main()
