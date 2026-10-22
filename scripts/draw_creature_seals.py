#!/usr/bin/env python3
"""
神兽符牌 64x64 × 4 —— 山海经图鉴式的印章/徽章造型。
思路：不画「会动会打的野兽」（AI 程序拼色块必然丑），改成「图鉴符牌」：
朱砂圆环 + 石青底 + 剪影 + 汉字，风格统一、不会难看。
"""
from PIL import Image, ImageDraw, ImageFont
import pathlib

S = 64
OUT = pathlib.Path("/Users/ryan/code/huanling-shanhai/public/assets/mvp/creatures_seal.png")

INK = (0x1b, 0x24, 0x26, 255)
AZURITE_D = (0x2f, 0x5d, 0x7a, 255)
AZURITE = (0x43, 0x78, 0x9b, 255)
MALACHITE = (0x46, 0x63, 0x55, 255)
MALACHITE_L = (0x5c, 0x7a, 0x62, 255)
CINNABAR = (0xb8, 0x6a, 0x4e, 255)
CINNABAR_D = (0x8f, 0x46, 0x33, 255)
PAPER = (0xd3, 0xc9, 0xb2, 255)
STONE = (0xb9, 0xae, 0x9a, 255)

FONT_PATH = "/System/Library/Fonts/Supplemental/Songti.ttc"


def ring(d: ImageDraw.ImageDraw, cx, cy, r, color, width=2):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=width)


def card(base_color, accent, glyph, silhouette):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 牌底：圆角方 + 双层边
    d.rounded_rectangle([2, 2, S - 3, S - 3], radius=10, fill=base_color, outline=INK, width=2)
    d.rounded_rectangle([5, 5, S - 6, S - 6], radius=8, outline=accent, width=1)
    # 内部圆环
    ring(d, S // 2, S // 2, 21, accent, 1)
    # 剪影
    silhouette(d, accent)
    # 汉字（右下角小篆感）
    try:
        f = ImageFont.truetype(FONT_PATH, 15)
        d.text((S - 15, S - 17), glyph, font=f, fill=PAPER)
    except Exception:
        pass
    return img


def sil_horse(d, c):
    """鹿蜀：马形，白首红尾"""
    d.polygon([(18, 40), (24, 30), (34, 24), (44, 26), (46, 31), (40, 33), (34, 35),
               (30, 44), (34, 47), (24, 47), (22, 43)], fill=c)
    d.ellipse([38, 20, 48, 28], fill=PAPER)  # 白首
    d.polygon([(45, 22), (50, 16), (51, 21), (47, 24)], fill=CINNABAR)  # 鬃
    d.line([(20, 40), (14, 34)], fill=CINNABAR, width=2)  # 赤尾


def sil_fish(d, c):
    """赤鱬：鱼身人面"""
    d.ellipse([16, 28, 46, 44], fill=c)
    d.polygon([(46, 36), (54, 28), (54, 44)], fill=CINNABAR)
    d.ellipse([38, 30, 46, 38], fill=PAPER)  # 人面
    d.point([(41, 33), (44, 33)], fill=INK)
    d.line([(22, 33), (34, 33)], fill=MALACHITE_L, width=1)


def sil_fox(d, c):
    """讙：一目三尾"""
    d.ellipse([22, 26, 42, 42], fill=c)
    d.polygon([(40, 28), (48, 22), (46, 32)], fill=c)  # 头
    d.ellipse([43, 26, 47, 30], fill=CINNABAR)  # 独目
    d.point([45, 28], fill=INK)
    for dy in (-6, 0, 6):
        d.line([(24, 34 + dy), (14, 32 + dy)], fill=CINNABAR, width=2)  # 三尾


def sil_rock(d, c):
    """石魅：山石成精"""
    d.polygon([(20, 46), (24, 30), (32, 22), (40, 30), (44, 46)], fill=c)
    d.polygon([(28, 46), (32, 34), (36, 46)], fill=INK)
    d.point([(30, 32), (34, 32)], fill=CINNABAR)


SPECS = [
    ("鹿", AZURITE_D, AZURITE, sil_horse),
    ("鱬", MALACHITE, MALACHITE_L, sil_fish),
    ("讙", CINNABAR_D, CINNABAR, sil_fox),
    ("魅", STONE, PAPER, sil_rock),
]


def main() -> None:
    sheet = Image.new("RGBA", (S * 4, S), (0, 0, 0, 0))
    for i, (g, base, accent, sil) in enumerate(SPECS):
        img = card(base, accent, g, sil)
        sheet.paste(img, (i * S, 0))
    sheet.save(OUT)
    print("wrote", OUT)

    preview = sheet.resize((S * 4 * 4, S * 4), Image.NEAREST)
    bg = Image.new("RGBA", preview.size, (0x1b, 0x24, 0x26, 255))
    bg.alpha_composite(preview)
    bg.save("/tmp/hl-shots/seal_preview.png")
    print("preview -> /tmp/hl-shots/seal_preview.png")


if __name__ == "__main__":
    main()
