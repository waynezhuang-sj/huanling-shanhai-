"""Validate the actual on-disk PNGs and their semantic manifest with Pillow."""
from pathlib import Path
from itertools import combinations
from PIL import Image
import json

ROOT = Path(__file__).resolve().parent


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def opened(name, size):
    path = ROOT / name
    require(path.is_file(), f'missing: {name}')
    with Image.open(path) as raw:
        require(raw.format == 'PNG', f'{name}: not PNG')
        raw.load()
        require(raw.size == size, f'{name}: {raw.size} != {size}')
        im = raw.convert('RGBA')
    print(f'OPEN {name}: PNG {im.width}x{im.height} OK')
    return im


def coverage(im, name):
    alpha = list(im.getchannel('A').get_flattened_data())
    ratio = sum(a > 0 for a in alpha) / len(alpha)
    require(ratio > .05, f'{name}: alpha coverage {ratio:.2%} <= 5%')
    require(set(alpha) <= {0, 255}, f'{name}: non-binary alpha')
    print(f'  {name}: alpha={ratio:.2%} OK')


manifest = json.loads((ROOT / 'manifest.json').read_text())
require(manifest['tileSize'] == 16, 'tileSize')
expected = {'tiles': (16, 16, 12, 33), 'hero': (16, 24, 4, 12),
            'npc': (16, 24, 3, 3), 'creatures': (64, 64, 2, 4)}
all_frames = {}
pngs = set()
print('MVP ASSET VERIFICATION (Pillow; actual on-disk PNGs)')
for key, (w, h, cols, count) in expected.items():
    spec = manifest['sheets'][key]
    require((spec['frameW'], spec['frameH'], spec['cols'], spec['count']) == (w, h, cols, count), f'{key}: manifest specification')
    require(spec['file'] == key+'.png', f'{key}: unexpected file')
    require(len(spec['names']) == count and len(set(spec['names'])) == count, f'{key}: semantic indices')
    rows = (count + cols - 1) // cols
    im = opened(spec['file'], (w*cols, h*rows)); pngs.add(spec['file'])
    require(len(set(im.get_flattened_data())) <= 16, f'{key}: palette exceeds 16 including transparency')
    print(f'  grid={cols}x{rows}, frame={w}x{h}, count={count}, colors={len(set(im.get_flattened_data()))} <=16 OK')
    frames = []
    for i in range(count):
        x, y = (i % cols)*w, (i//cols)*h
        frame = im.crop((x, y, x+w, y+h)); frames.append(frame)
        coverage(frame, f'{key}[{i:02}] {spec["names"][i]}')
    for i in range(count, cols*rows):
        x, y = (i % cols)*w, (i//cols)*h
        require(im.crop((x, y, x+w, y+h)).getchannel('A').getbbox() is None, f'{key}: padding cell {i} not empty')
        print(f'  {key}[{i:02}]: unused transparent cell OK')
    all_frames[key] = frames

required_tiles = {'grass': [0, 1, 2], 'path': [3, 4, 5], 'water': [6, 7], 'tree': [8, 9, 10],
                  'bush': [11, 12, 13], 'flower': 14, 'mushroom': 15, 'rock': [16, 17],
                  'roofL': 18, 'roofM': 19, 'roofR': 20, 'wallL': 21, 'wallM': 22, 'wallR': 23,
                  'door': [24, 25], 'window': [26, 27], 'fenceL': 28, 'fenceM': 29, 'fenceR': 30,
                  'sign': 31, 'crate': 32}
require(manifest['tiles'] == required_tiles, 'tile semantic index mismatch')
require(manifest['sheets']['npc']['names'] == ['healer', 'merchant', 'villager'], 'NPC order')
require(manifest['sheets']['creatures']['names'] == ['lushu', 'chiru', 'huan', 'shimei'], 'creature order')
print('SEMANTICS: all tile/NPC/creature indices match the task OK')
for i, frame in enumerate(all_frames['creatures']):
    x0, y0, x1, y1 = frame.getchannel('A').getbbox()
    require(x0 >= 4 and y0 >= 4 and x1 <= 60 and y1 <= 60, f'creature {i}: 4px margin')
    require(tuple(bytes.fromhex('2f2632'))+(255,) in set(frame.get_flattened_data()), f'creature {i}: no outline color')
    print(f'CREATURE {i}: bbox=({x0},{y0},{x1},{y1}), 4px margin, outline, colors={len(set(frame.get_flattened_data()))} OK')
for a, b in combinations(range(4), 2):
    # Denominator includes all 4096 pixels, not just the foreground union.
    fa, fb = all_frames['creatures'][a], all_frames['creatures'][b]
    diff = sum(x != y for x, y in zip(fa.get_flattened_data(), fb.get_flattened_data())) / (64*64)
    require(diff > .10, f'creatures {a}/{b}: pixel difference <=10%')
    print(f'CREATURE DIFF {a}/{b}: {diff:.2%} >10% OK')
directions = manifest['sheets']['hero']['directions']
require(directions == {'down': [0, 1, 2], 'left': [3, 4, 5], 'right': [6, 7, 8], 'up': [9, 10, 11]}, 'hero direction map')
for a, b in combinations([0, 3, 6, 9], 2):
    require(all_frames['hero'][a].tobytes() != all_frames['hero'][b].tobytes(), f'hero first frames {a}/{b} identical')
    print(f'HERO FIRST {a}/{b}: different OK')
for direction, indices in directions.items():
    require(len({all_frames['hero'][i].tobytes() for i in indices}) == 3, f'{direction}: duplicate walk poses')
    print(f'HERO {direction}: 3 distinct poses OK')

ui_spec = manifest['ui']
require(ui_spec['file'] == 'ui.png' and (ui_spec['width'], ui_spec['height']) == (256, 128), 'UI specification')
ui = opened(ui_spec['file'], (256, 128)); pngs.add(ui_spec['file'])
require(len(set(ui.get_flattened_data())) <= 16, 'UI palette')
require(set(ui_spec['parts']) == {'dialog', 'button', 'hpBack', 'hpFill', 'joystickBase', 'joystickThumb'}, 'missing UI part')
rectangles = []
for name, (x, y, w, h) in ui_spec['parts'].items():
    require(min(x, y) >= 0 and min(w, h) > 0 and x+w <= ui.width and y+h <= ui.height, f'UI {name}: bounds')
    for ox, oy, ow, oh in rectangles:
        require(x+w <= ox or ox+ow <= x or y+h <= oy or oy+oh <= y, f'UI {name}: overlapping part')
    rectangles.append((x, y, w, h))
    coverage(ui.crop((x, y, x+w, y+h)), f'ui.{name} [{x},{y},{w},{h}]')
for name in ['dialog', 'button']:
    require(ui_spec['nineSlice'][name] == dict(left=3, right=3, top=3, bottom=3), f'{name}: missing nine-slice borders')
print('UI: all 6 rectangles in bounds and disjoint; dialog/button nine-slice borders OK')
preview = manifest['preview']
require(preview == {'file': 'contact_sheet.png', 'width': 1200, 'height': 1120}, 'preview specification')
im = opened(preview['file'], (1200, 1120)); pngs.add(preview['file'])
require(len(set(im.get_flattened_data())) > 16, 'contact sheet appears empty or lacks labels')
coverage(im, 'contact_sheet')
require(pngs == {p.name for p in ROOT.rglob('*.png')}, 'unexpected PNG not covered by verification')
for name in ['CREDITS.md', '_generate.py', 'sources/provenance.json', 'sources/CC0-1.0.txt']:
    require((ROOT / name).is_file() and (ROOT / name).stat().st_size > 0, f'missing auxiliary file: {name}')
print('PASS: 6 PNG files opened; 52 sprite frames + 6 UI parts verified; all assertions passed.')
