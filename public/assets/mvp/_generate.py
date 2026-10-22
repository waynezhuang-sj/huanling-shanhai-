"""Reproducible asset preparation. Writes only beside this script; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import io
import json
import zipfile

ROOT = Path(__file__).resolve().parent
PALETTE = ['#2f2632', '#57404a', '#8b5a48', '#b9845b', '#d9ad72',
           '#f2d8b5', '#fff0ce', '#af4147', '#eb6b4c', '#719c58',
           '#416a4c', '#9ec76e', '#536b86', '#84a4b7', '#a3a29a']
O, S, WOOD, TAN, GOLD, SKIN, WHITE, RED, ORANGE, GREEN, DG, LG, BLUE, BG, GRAY = PALETTE


def blank(size):
    return Image.new('RGBA', size)


def source(pack, index):
    with zipfile.ZipFile(ROOT / 'sources' / f'{pack}.zip') as z:
        prefix = 'Tiles/Small tiles/Thick outline/' if pack.startswith('ui-') else 'Tiles/'
        return Image.open(io.BytesIO(z.read(f'{prefix}tile_{index:04}.png'))).convert('RGBA')


def limited(im):
    """Nearest palette mapping without dithering; preserve binary transparency."""
    rgb = [tuple(bytes.fromhex(c[1:])) for c in PALETTE]
    out = blank(im.size)
    cache = {}
    pixels = []
    for r, g, b, a in im.convert('RGBA').get_flattened_data():
        if not a:
            pixels.append((0, 0, 0, 0))
            continue
        key = (r, g, b)
        if key not in cache:
            cache[key] = min(rgb, key=lambda c: sum((x-y)**2 for x, y in zip(key, c))) + (255,)
        pixels.append(cache[key])
    out.putdata(pixels)
    return out


def sheet(frames, cols, name):
    w, h = frames[0].size
    out = blank((cols*w, ((len(frames)+cols-1)//cols)*h))
    for i, frame in enumerate(frames):
        out.paste(limited(frame), ((i % cols)*w, (i//cols)*h))
    out.save(ROOT / name)
    return out


def tile(i):
    return source('tiny-town', i)


# Tile indices are deliberately independent of the pre-existing atlas.png.
tiles = [tile(i) for i in [0, 1, 2, 25, 24, 26]]
for phase in range(2):
    im = Image.new('RGBA', (16, 16), BLUE)
    d = ImageDraw.Draw(im)
    for x, y in [(1, 3), (9, 8), (3, 13)]:
        d.line((x+phase, y, min(15, x+phase+4), y), fill=BG)
    tiles.append(im)
tiles += [tile(5), tile(4), tile(3), tile(28), tile(17), tile(16)]
im = blank((16, 16)); d = ImageDraw.Draw(im)
for x, y in [(5, 4), (10, 8), (4, 11)]:
    d.line((x, y+1, x, 15), fill=DG)
    d.rectangle((x-2, y-1, x+2, y+1), fill=WHITE, outline=O)
    d.point((x, y), fill=GOLD)
tiles += [im, tile(29)]
for variant in range(2):
    im = blank((16, 16)); d = ImageDraw.Draw(im)
    points = [(2, 12), (3, 7), (6, 4), (11, 5), (14, 10), (13, 14), (4, 14)]
    if variant: points = [(1, 13), (3, 8), (7, 7), (9, 10), (13, 10), (15, 14), (2, 14)]
    d.polygon(points, fill=GRAY, outline=O); d.line((4, 9, 6, 6, 10, 6), fill=BG)
    tiles.append(im)
tiles += [tile(i) for i in [52, 53, 54, 72, 73, 75, 74, 85, 84, 88, 44, 45, 46, 83]]
im = blank((16, 16)); d = ImageDraw.Draw(im)
d.rectangle((2, 2, 13, 14), fill=TAN, outline=O)
d.rectangle((4, 4, 11, 12), fill=WOOD, outline=GOLD)
d.line((3, 3, 12, 13), fill=GOLD); d.line((12, 3, 3, 13), fill=GOLD)
tiles.append(im)
assert len(tiles) == 33
sheet(tiles, 12, 'tiles.png')


def person(direction='down', step=0, role='hero'):
    im = blank((16, 24)); d = ImageDraw.Draw(im)
    robe = {'hero': BLUE, 'healer': DG, 'merchant': RED, 'villager': GREEN}[role]
    hair = GRAY if role == 'healer' else O
    # Stretching a source head is avoided: retain the 16px head's source pixels.
    idx = {'hero': 86, 'healer': 100, 'merchant': 86, 'villager': 99}[role]
    head = source('tiny-dungeon', idx).crop((3, 1, 13, 8))
    im.paste(head, (3, 2))
    d.rectangle((4, 9, 11, 19), fill=robe, outline=O)
    d.rectangle((3, 11, 4, 16), fill=robe, outline=O)
    d.rectangle((11, 11, 12, 16), fill=robe, outline=O)
    d.rectangle((5, 17, 10, 18), fill=GOLD)
    # Three poses: neutral, left stride, right stride. Feet stay in frame.
    left_y, right_y = [(22, 22), (23, 21), (21, 23)][step]
    d.rectangle((5, 19, 6, left_y), fill=S); d.rectangle((9, 19, 10, right_y), fill=S)
    d.line((4, left_y, 6, left_y), fill=O); d.line((9, right_y, 11, right_y), fill=O)
    if direction == 'up':
        d.rectangle((3, 2, 12, 8), fill=hair)
        d.rectangle((5, 1, 10, 3), fill=hair)
        d.rectangle((5, 10, 10, 15), fill=WOOD, outline=O)
        d.line((6, 11, 9, 11), fill=TAN)
    elif direction in ('left', 'right'):
        # Draw left profile once; mirror the complete figure for right.
        d.rectangle((3, 2, 12, 8), fill=hair)
        d.rectangle((2, 5, 7, 9), fill=SKIN)
        d.point((3, 5), fill=O); d.line((2, 8, 4, 8), fill=TAN)
        d.rectangle((7, 11, 11, 16), fill=WOOD, outline=O)
        d.line((4, 12, 4, 15), fill=SKIN)
        if direction == 'right': im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    else:
        d.rectangle((4, 3, 11, 5), fill=hair)
        d.rectangle((4, 5, 11, 8), fill=SKIN)
        d.point((5, 6), fill=O); d.point((10, 6), fill=O)
        d.line((7, 8, 8, 8), fill=TAN)
        d.line((6, 10, 8, 14, 10, 10), fill=WHITE)
    if role == 'healer':
        d.rectangle((4, 2, 11, 4), fill=GRAY)
        d.polygon([(5, 8), (10, 8), (9, 12), (7, 13)], fill=WHITE)
        d.line((13, 9, 13, 23), fill=O); d.line((14, 10, 14, 22), fill=WOOD)
    elif role == 'merchant':
        d.rectangle((1, 12, 3, 20), fill=TAN, outline=O)
        d.line((1, 15, 3, 15), fill=GOLD)
        d.rectangle((4, 3, 11, 4), fill=RED)
    elif role == 'villager':
        d.rectangle((3, 4, 4, 12), fill=O); d.rectangle((11, 4, 12, 12), fill=O)
        d.rectangle((5, 12, 10, 19), fill=WHITE, outline=O)
        d.rectangle((2, 15, 5, 18), fill=BLUE, outline=O)
    return im


directions = ['down', 'left', 'right', 'up']
hero = [person(direction, step) for direction in directions for step in range(3)]
sheet(hero, 4, 'hero.png')
npcs = [person(role=role) for role in ['healer', 'merchant', 'villager']]
sheet(npcs, 3, 'npc.png')


def beast(index):
    im = blank((64, 64)); d = ImageDraw.Draw(im)
    def poly(points, fill): d.polygon(points, fill=fill, outline=O, width=1)
    if index == 0:  # Lushu: horse anatomy, white face, tiger stripes, red tail.
        poly([(46, 27), (53, 22), (57, 27), (58, 40), (54, 45), (52, 35)], RED)
        poly([(22, 27), (43, 25), (49, 29), (48, 40), (26, 41), (20, 35)], TAN)
        for x in [25, 42]:
            poly([(x, 36), (x+5, 36), (x+4, 53), (x-2, 53)], WOOD)
            d.rectangle((x-2, 51, x+4, 54), fill=O)
        poly([(19, 18), (26, 23), (29, 36), (20, 37), (15, 27)], GOLD)
        poly([(12, 13), (13, 6), (17, 11), (23, 8), (24, 16), (21, 23),
              (11, 26), (5, 23), (5, 18)], WHITE)
        d.line((13, 13, 20, 12), fill=SKIN, width=2)
        d.rectangle((10, 16, 12, 17), fill=O); d.point((6, 21), fill=O)
        for x in [28, 35, 42]: poly([(x, 27), (x+3, 27), (x+1, 35), (x-1, 33)], O)
        d.line((23, 23, 25, 29, 24, 34), fill=DG, width=2)
    elif index == 1:  # Chiru: human face on a red fish, looking left.
        poly([(26, 22), (34, 11), (42, 17), (44, 26)], RED)
        poly([(42, 28), (59, 16), (55, 31), (59, 46), (43, 39)], ORANGE)
        poly([(17, 24), (29, 20), (42, 23), (49, 30), (45, 40), (30, 45), (17, 39)], RED)
        poly([(25, 40), (33, 40), (31, 53), (22, 47)], ORANGE)
        poly([(14, 22), (23, 24), (25, 32), (22, 40), (12, 40), (9, 35),
              (5, 33), (9, 29), (9, 25)], SKIN)
        d.line((10, 26, 19, 25, 22, 28), fill=O, width=2)
        d.rectangle((10, 29, 13, 30), fill=O)
        d.line((9, 36, 15, 36), fill=RED)
        d.line((13, 39, 18, 39, 21, 35), fill=TAN)
        for x, y in [(28, 27), (35, 29), (29, 35), (37, 37)]:
            d.line((x, y, x+2, y+2, x+4, y), fill=ORANGE)
        d.line((50, 30, 55, 23), fill=RED); d.line((50, 34, 55, 41), fill=RED)
    elif index == 2:  # Huan: feline, white head, one conspicuous eye.
        poly([(41, 35), (49, 31), (51, 19), (47, 14), (48, 9), (55, 12),
              (59, 21), (57, 37), (49, 44), (42, 44)], RED)
        poly([(19, 30), (29, 25), (40, 29), (48, 40), (43, 49), (22, 48), (16, 41)], ORANGE)
        poly([(22, 42), (27, 43), (25, 53), (14, 53), (14, 50)], RED)
        poly([(37, 42), (43, 42), (44, 51), (36, 53), (32, 51)], RED)
        poly([(8, 23), (7, 8), (18, 15), (28, 9), (29, 26), (26, 34),
              (16, 37), (5, 31), (5, 27)], WHITE)
        poly([(10, 14), (11, 21), (16, 20)], RED)
        poly([(24, 15), (25, 21), (20, 20)], RED)
        d.ellipse((10, 22, 20, 30), fill=O)
        d.ellipse((12, 23, 18, 28), fill=GOLD); d.rectangle((14, 23, 15, 28), fill=O)
        d.point((13, 24), fill=WHITE)
        d.line((6, 31, 10, 31), fill=RED)
        d.line((26, 36, 33, 33, 37, 37), fill=RED, width=2)
        d.line((28, 43, 31, 39), fill=GOLD, width=2)
    else:  # Shimei: eyeless stone mass, asymmetrical left-facing head.
        poly([(19, 13), (26, 6), (38, 8), (44, 19), (40, 31), (19, 30), (11, 22)], GRAY)
        poly([(10, 19), (20, 16), (29, 21), (26, 30), (14, 30), (5, 26)], GRAY)
        poly([(20, 28), (39, 24), (48, 33), (47, 46), (37, 51), (17, 48), (13, 38)], WOOD)
        poly([(10, 30), (19, 31), (19, 46), (12, 50), (5, 46), (5, 38)], GRAY)
        poly([(43, 29), (53, 32), (58, 44), (56, 51), (46, 49), (43, 41)], GRAY)
        poly([(19, 46), (29, 46), (27, 56), (14, 56), (13, 52)], GRAY)
        poly([(35, 46), (44, 45), (49, 54), (47, 57), (34, 57)], GRAY)
        d.line((24, 10, 31, 13, 28, 19, 32, 24), fill=S, width=2)
        d.line((18, 34, 26, 31, 34, 35, 39, 32), fill=TAN, width=2)
        d.line((25, 37, 29, 42, 25, 47), fill=O)
        d.line((48, 36, 51, 39, 49, 45), fill=S)
        d.line((14, 20, 19, 19), fill=BG)
    return im


creatures = [beast(i) for i in range(4)]
sheet(creatures, 2, 'creatures.png')


def ui_source(index):
    im = source('ui-pack-pixel-adventure', index)
    return im.crop(im.getbbox())


def nine_slice(im, size, border=3):
    out = blank(size)
    w, h = im.size; tw, th = size
    xs, ys = [0, border, w-border, w], [0, border, h-border, h]
    tx, ty = [0, border, tw-border, tw], [0, border, th-border, th]
    for y in range(3):
        for x in range(3):
            part = im.crop((xs[x], ys[y], xs[x+1], ys[y+1]))
            out.paste(part.resize((tx[x+1]-tx[x], ty[y+1]-ty[y]), Image.Resampling.NEAREST), (tx[x], ty[y]))
    return out


ui = blank((256, 128))
ui.paste(nine_slice(ui_source(12), (96, 48)), (0, 0))
ui.paste(nine_slice(ui_source(10), (64, 24)), (104, 0))
ui.paste(nine_slice(ui_source(13), (80, 12), 2), (104, 32))
d = ImageDraw.Draw(ui); d.rectangle((108, 52, 179, 55), fill=RED)
ui.paste(ui_source(0).resize((48, 48), Image.Resampling.NEAREST), (0, 64))
ui.paste(ui_source(1).resize((24, 24), Image.Resampling.NEAREST), (56, 76))
ui = limited(ui); ui.save(ROOT / 'ui.png')

tile_names = ['grass_plain', 'grass_tuft', 'grass_flower', 'path_center', 'path_left', 'path_right',
              'water_0', 'water_1', 'tree_round', 'tree_pointed', 'tree_autumn', 'bush_0', 'bush_1', 'bush_2',
              'flower', 'mushroom', 'rock_0', 'rock_1', 'roof_left', 'roof_middle', 'roof_right',
              'wall_left', 'wall_middle', 'wall_right', 'door_open', 'door_closed', 'window_0', 'window_1',
              'fence_left', 'fence_middle', 'fence_right', 'sign', 'crate']
manifest = {
    'tileSize': 16,
    'sheets': {
        'tiles': {'file': 'tiles.png', 'frameW': 16, 'frameH': 16, 'cols': 12, 'count': 33, 'names': tile_names},
        'hero': {'file': 'hero.png', 'frameW': 16, 'frameH': 24, 'cols': 4, 'count': 12,
                 'layout': '4列×3行，行优先索引；每方向连续3帧：0-2下、3-5左、6-8右、9-11上',
                 'directions': {direction: list(range(i*3, i*3+3)) for i, direction in enumerate(directions)},
                 'names': [f'{direction}_{pose}' for direction in directions for pose in ['idle', 'step_left', 'step_right']]},
        'npc': {'file': 'npc.png', 'frameW': 16, 'frameH': 24, 'cols': 3, 'count': 3,
                'names': ['healer', 'merchant', 'villager']},
        'creatures': {'file': 'creatures.png', 'frameW': 64, 'frameH': 64, 'cols': 2, 'count': 4,
                      'names': ['lushu', 'chiru', 'huan', 'shimei'], 'elements': ['wood', 'water', 'fire', 'earth']}
    },
    'tiles': {'grass': [0, 1, 2], 'path': [3, 4, 5], 'water': [6, 7], 'tree': [8, 9, 10],
              'bush': [11, 12, 13], 'flower': 14, 'mushroom': 15, 'rock': [16, 17],
              'roofL': 18, 'roofM': 19, 'roofR': 20, 'wallL': 21, 'wallM': 22, 'wallR': 23,
              'door': [24, 25], 'window': [26, 27], 'fenceL': 28, 'fenceM': 29, 'fenceR': 30,
              'sign': 31, 'crate': 32},
    'ui': {'file': 'ui.png', 'width': 256, 'height': 128,
           'parts': {'dialog': [0, 0, 96, 48], 'button': [104, 0, 64, 24], 'hpBack': [104, 32, 80, 12],
                     'hpFill': [108, 52, 72, 4], 'joystickBase': [0, 64, 48, 48], 'joystickThumb': [56, 76, 24, 24]},
           'nineSlice': {'dialog': {'left': 3, 'right': 3, 'top': 3, 'bottom': 3},
                         'button': {'left': 3, 'right': 3, 'top': 3, 'bottom': 3}},
           'hpFillInset': [4, 4]},
    'preview': {'file': 'contact_sheet.png', 'width': 1200, 'height': 1120},
    'palette': ['#00000000'] + PALETTE,
    'indexing': 'zero-based, row-major; unused tile cells 33-35 are transparent'
}
(ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')

# Contact sheet labels are Latin semantic keys so no system CJK font is required.
preview = Image.new('RGB', (1200, 1120), '#e4dfd1'); draw = ImageDraw.Draw(preview)
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13) if Path('/System/Library/Fonts/Supplemental/Arial.ttf').exists() else ImageFont.load_default()


def label(x, y, text): draw.text((x, y), text, font=font, fill='#2f2632')


def show(im, x, y, scale):
    enlarged = im.resize((im.width*scale, im.height*scale), Image.Resampling.NEAREST)
    # Checkerboard makes transparent backgrounds explicit.
    for yy in range(y, y+enlarged.height, 8):
        for xx in range(x, x+enlarged.width, 8):
            draw.rectangle((xx, yy, min(xx+7, x+enlarged.width-1), min(yy+7, y+enlarged.height-1)), fill='#bebdaf' if ((xx-x)//8+(yy-y)//8)%2 else '#d4d2c7')
    preview.paste(enlarged, (x, y), enlarged)


label(16, 10, 'HUANLING SHANHAI | MVP ASSETS | zero-based indices | nearest-neighbor preview')
label(16, 38, 'TILES | 16x16 | 12 columns | 33 frames; cells 33-35 empty')
for i, frame in enumerate(tiles):
    x=16+(i%12)*98; y=64+(i//12)*92
    show(limited(frame), x, y, 3); label(x, y+50, f'{i}: {tile_names[i]}')
label(16, 350, 'HERO | 16x24 | physical grid 4x3 | direction groups use 3 consecutive indices')
for i, frame in enumerate(hero):
    x=16+i*98; show(limited(frame), x, 376, 3)
    label(x, 451, f'{i}: {directions[i//3]} / {i%3}')
label(16, 486, 'NPC | 16x24 | 3 frames')
for i, frame in enumerate(npcs):
    x=16+i*140; show(limited(frame), x, 512, 3); label(x, 588, f'{i}: {manifest["sheets"]["npc"]["names"][i]}')
label(16, 624, 'CREATURES | 64x64 | left-facing | 4px transparent margin | <=16 colors including transparency')
for i, frame in enumerate(creatures):
    x=16+i*292; show(frame, x, 650, 3)
    label(x, 847, f'{i}: {manifest["sheets"]["creatures"]["names"][i]} / {manifest["sheets"]["creatures"]["elements"][i]}')
label(16, 886, 'UI | source atlas rectangles [x,y,w,h]; dialog/button are 9-slice panels')
for i, (name, (x, y, w, h)) in enumerate(manifest['ui']['parts'].items()):
    px = 16 + (i%3)*390; py = 916 + (i//3)*100
    show(ui.crop((x, y, x+w, y+h)), px, py, 1 if name == 'joystickBase' else 2)
    label(px+200, py+8, name); label(px+200, py+29, f'[{x},{y},{w},{h}]')
preview.save(ROOT / 'contact_sheet.png')
print('Generated tiles.png hero.png npc.png creatures.png ui.png manifest.json contact_sheet.png')
