#!/usr/bin/env python3
"""
把 Kenney 地形图集重映射到《山海行》的青绿山水调色板。
参考：工笔线条 + 石青石绿 + 朱砂设色 + 暖灰石板（杉泽《观山海》设色方向）
"""
from PIL import Image, ImageDraw
import pathlib

SRC = pathlib.Path("/Users/ryan/code/huanling-shanhai/public/assets/atlas.png")
DST = pathlib.Path("/Users/ryan/code/huanling-shanhai/public/assets/atlas_shanhai.png")

# 16 色 · 青绿山水
PALETTE = [
    (0x1b, 0x24, 0x26),  # 0 墨黑
    (0x2c, 0x3a, 0x3d),  # 1 淡墨
    (0x33, 0x4d, 0x46),  # 2 苔绿最深
    (0x46, 0x63, 0x55),  # 3 苔绿
    (0x5c, 0x7a, 0x62),  # 4 石绿
    (0x7a, 0x94, 0x74),  # 5 石绿浅
    (0x9a, 0xab, 0x86),  # 6 草绿灰
    (0x2f, 0x5d, 0x7a),  # 7 石青深
    (0x43, 0x78, 0x9b),  # 8 石青
    (0x76, 0xa3, 0xb8),  # 9 石青浅
    (0x8f, 0x46, 0x33),  # 10 朱砂深
    (0xb8, 0x6a, 0x4e),  # 11 朱砂
    (0x8c, 0x7a, 0x5e),  # 12 赭石
    (0xb9, 0xae, 0x9a),  # 13 暖灰石板
    (0xd3, 0xc9, 0xb2),  # 14 浅石
    (0xe8, 0xe0, 0xcc),  # 15 米白
]


def make_palette_image() -> Image.Image:
    pal = Image.new("P", (16, 1))
    flat = []
    for c in PALETTE:
        flat.extend(c)
    pal.putpalette(flat + [0, 0, 0] * (256 - 16))
    return pal


def remap(img: Image.Image) -> Image.Image:
    """只处理不透明像素，透明区域保持透明。"""
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    pal_img = make_palette_image()
    # 量化到自定义调色板（RGB 部分）
    rgb = rgba.convert("RGB")
    q = rgb.quantize(palette=pal_img, dither=Image.Dither.NONE).convert("RGB")
    out = q.convert("RGBA")
    out.putalpha(alpha)
    return out


def repaint_base_tiles(img: Image.Image) -> Image.Image:
    """草地/土路基底重画：Kenney 原图里的装饰小点重映射后像垃圾，改成同色系细噪点。"""
    import random
    rnd = random.Random(20261022)
    out = img.copy()
    d = ImageDraw.Draw(out)

    def tile_xy(idx):
        return (idx % 12) * 16, (idx // 12) * 16

    def fill_tile(idx, base, speck, count, dark_edge=None):
        ox, oy = tile_xy(idx)
        d.rectangle([ox, oy, ox + 15, oy + 15], fill=base)
        for _ in range(count):
            x = ox + rnd.randrange(0, 16)
            y = oy + rnd.randrange(0, 16)
            d.point((x, y), fill=speck)
        if dark_edge:
            d.rectangle([ox, oy + 15, ox + 15, oy + 15], fill=dark_edge)

    # 草地：石绿系
    fill_tile(0, (0x5c, 0x7a, 0x62, 255), (0x46, 0x63, 0x55, 255), 26)
    fill_tile(1, (0x55, 0x71, 0x5b, 255), (0x46, 0x63, 0x55, 255), 34)
    # 土路：暖灰石板，边缘加深形成路沿
    fill_tile(25, (0xb9, 0xae, 0x9a, 255), (0xa8, 0x9d, 0x89, 255), 22,
              dark_edge=(0x8f, 0x86, 0x74, 255))
    return out

def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    out = repaint_base_tiles(remap(src))
    out.save(DST)
    print(f"wrote {DST} ({out.size[0]}x{out.size[1]})")

    # 对比图：原图在上、重映射在下
    w, h = src.size
    cmp_img = Image.new("RGBA", (w, h * 2 + 6), (20, 24, 26, 255))
    cmp_img.paste(src, (0, 0))
    cmp_img.paste(out, (0, h + 6))
    big = cmp_img.resize((w * 3, (h * 2 + 6) * 3), Image.NEAREST)
    big.save("/tmp/hl-shots/palette_compare.png")
    print("compare -> /tmp/hl-shots/palette_compare.png")


if __name__ == "__main__":
    main()
