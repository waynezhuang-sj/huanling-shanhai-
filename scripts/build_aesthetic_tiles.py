#!/usr/bin/env python3
"""Postprocess imagegen artwork; never draws replacement illustrations.

Only cropping, resizing, alpha cleanup, quantization, compositing and edge
pixel reconciliation are used. Run from any working directory.
"""
from pathlib import Path
import argparse
import json
import subprocess
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
MVP = ROOT / 'public/assets/mvp'
ART = MVP / 'aesthetic'
NAMES = ['grass_plain', 'grass_tuft', 'grass_moss', 'path_center',
         'path_left', 'path_right', 'water_0', 'water_1', 'tree_broadleaf',
         'tree_pine', 'tree_autumn', 'bush_0', 'bush_1', 'bush_2',
         'flower', 'mushroom', 'rock_0', 'rock_1', 'roof_left',
         'roof_middle', 'roof_right', 'wall_left', 'wall_middle',
         'wall_right', 'door_open', 'door_closed', 'window_0',
         'window_1', 'fence_left', 'fence_middle', 'fence_right',
         'sign', 'crate', 'reeds', 'lantern']


def frame(im, i, cols=12):
    x, y = i % cols * 16, i // cols * 16
    return im.crop((x, y, x+16, y+16))


def sheet(frames):
    im = Image.new('RGBA', (192, 48))
    for i, tile in enumerate(frames):
        im.paste(tile, (i % 12 * 16, i // 12 * 16))
    return im


def maps():
    # Read-only transpilation; no changes to TypeScript or runtime code.
    js = """const fs=require('fs'),ts=require('typescript'),vm=require('vm');
const code=ts.transpileModule(fs.readFileSync('src/data/maps.ts','utf8'),
{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const box={exports:{}};vm.runInNewContext(code,box);
process.stdout.write(JSON.stringify(box.exports.MAPS));"""
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))


def reconcile(images, pairs):
    """Equality constraints on edge pixels; average existing artwork colors.

    A corner belongs to both edges, so union-find resolves corners together.
    pairs are (frame A, side, frame B, opposite side).
    """
    parent = {}
    def find(k):
        parent.setdefault(k, k)
        if parent[k] != k:
            parent[k] = find(parent[k])
        return parent[k]
    def coords(side):
        return {'L': [(0,y) for y in range(16)],
                'R': [(15,y) for y in range(16)],
                'T': [(x,0) for x in range(16)],
                'B': [(x,15) for x in range(16)]}[side]
    for a, sa, b, sb in pairs:
        for p, q in zip(coords(sa), coords(sb)):
            x, y = find((a,*p)), find((b,*q))
            parent[x] = y
    groups = defaultdict(list)
    for k in parent:
        groups[find(k)].append(k)
    for group in groups.values():
        colors = [images[i].getpixel((x,y)) for i,x,y in group]
        color = tuple(round(sum(c[ch] for c in colors)/len(colors)) for ch in range(4))
        if color[3] == 0:
            color = (0,0,0,0)
        for i,x,y in group:
            images[i].putpixel((x,y), color)


def surface_pairs():
    pairs = []
    for family in [[0,1,2], [6,7]]:
        for a in family:
            for b in family:
                pairs += [(a,'R',b,'L'), (a,'B',b,'T')]
    pairs += [(3,'R',3,'L'), (3,'B',3,'T')]
    for a in [4,5]:
        pairs += [(a,'B',a,'T')]
    pairs += [(4,'R',3,'L'), (3,'R',5,'L')]
    for g in [0,1,2]:
        pairs += [(g,'R',4,'L'), (5,'R',g,'L')]
    for l,m,r in [(18,19,20),(21,22,23),(28,29,30)]:
        pairs += [(l,'R',m,'L'), (m,'R',m,'L'), (m,'R',r,'L')]
    for i in [18,19,20,21,22,23]:
        pairs += [(i,'B',i,'T')]
    for i in [24,25,26,27]:
        pairs += [(22,'R',i,'L'), (i,'R',22,'L'),
                  (22,'B',i,'T'), (i,'B',22,'T')]
    return pairs


def cut_art(revision):
    source = Image.open(ART/'terrain_source.png').convert('RGBA')
    frames = []
    for i in range(35):
        # Imagegen painted two railing endpoints and left two final cells empty.
        # Middle rail is a crop of painted rails, not a redrawn shape.
        source_i = i if i<29 else {29:28,30:29,31:30,32:31,33:32,34:33}[i]
        x,y = source_i%6, source_i//6
        crop = source.crop((round(x*source.width/6)+3,round(y*source.height/6)+3,
                            round((x+1)*source.width/6)-3,round((y+1)*source.height/6)-3))
        if revision and i<8:
            ground = Image.open(ART/'ground_source_v2.png').convert('RGBA')
            gx,gy=i%4,i//4
            crop=ground.crop((round(gx*ground.width/4)+2,round(gy*ground.height/2)+2,
                              round((gx+1)*ground.width/4)-2,round((gy+1)*ground.height/2)-2))
        if i == 29:
            crop = crop.crop((round(crop.width*.45),0,crop.width,crop.height))
        if i in list(range(8)) + list(range(21,28)):
            bg = Image.new('RGBA', crop.size, (190,185,160,255))
            bg.alpha_composite(crop)
            crop = bg
        elif i not in [18,19,20,28,29,30]:
            # Preserve source alpha; fit the existing painted silhouette.
            bbox = crop.getchannel('A').point(lambda a: 255 if a>90 else 0).getbbox()
            if bbox:
                crop = crop.crop(bbox)
                crop.thumbnail((224,224), Image.Resampling.LANCZOS)
                pad = Image.new('RGBA',(256,256))
                pad.alpha_composite(crop,((256-crop.width)//2,256-crop.height-16))
                crop = pad
        tile = crop.resize((16,16),Image.Resampling.LANCZOS)
        alpha = tile.getchannel('A').point(lambda a:255 if a>=110 else 0)
        rgb = ImageEnhance.Color(tile.convert('RGB')).enhance(0.82)
        if revision and i>=8:
            # Restore ink/value separation after reduction (postprocessing only).
            rgb = ImageEnhance.Contrast(rgb).enhance(1.10)
        tile = rgb.quantize(colors=32,dither=Image.Dither.NONE).convert('RGBA')
        tile.putalpha(alpha)
        for yy in range(16):
            for xx in range(16):
                if tile.getpixel((xx,yy))[3] == 0:
                    tile.putpixel((xx,yy),(0,0,0,0))
        frames.append(tile)
    if revision:
        reconcile(frames,surface_pairs())
    return frames


def runtime(frames, revision):
    original = Image.open(ART/'atlas_before.png').convert('RGBA')
    cells = [frame(original,i) for i in range(original.width*original.height//256)]
    mapping = {0:0,1:1,2:14,5:9,15:10,16:8,18:11,28:9,29:15,30:13,
               44:28,45:29,46:30,83:31,84:26,85:25,88:27,89:25}
    for group in [[48,49,50],[52,53,54],[60,61,62],[64,65,66]]:
        mapping.update(dict(zip(group,[18,19,20])))
    for group in [[72,73,75],[76,77,79]]:
        mapping.update(dict(zip(group,[21,22,23])))
    for dest,src in mapping.items():
        cells[dest] = frames[src].copy()
    if revision:
        # Separate painted cap, repeating ceramic field and plaster interior.
        # The game's existing roof spans four rows; full eaves cannot repeat.
        source=Image.open(ART/'terrain_source.png').convert('RGBA')
        def module(i,ya,yb):
            x,y=i%6,i//6
            x0,y0=round(x*source.width/6)+3,round(y*source.height/6)+3
            cw,ch=round(source.width/6)-6,round(source.height/6)-6
            crop=source.crop((x0,y0+round(ya*ch),x0+cw,y0+round(yb*ch)))
            tile=crop.resize((16,16),Image.Resampling.LANCZOS)
            alpha=tile.getchannel('A').point(lambda a:255 if a>=110 else 0)
            tile=ImageEnhance.Color(tile.convert('RGB')).enhance(.82)
            tile=tile.quantize(colors=32,dither=Image.Dither.NONE).convert('RGBA')
            tile.putalpha(alpha)
            return tile
        for group in [[48,49,50],[52,53,54]]:
            for dest,src in zip(group,[18,19,20]):cells[dest]=module(src,0,.36)
        for group in [[60,61,62],[64,65,66]]:
            for dest,src in zip(group,[18,19,20]):cells[dest]=module(src,.36,.76)
        for group in [[72,73,75],[76,77,79]]:
            for dest,src in zip(group,[21,22,23]):cells[dest]=module(src,.28,.74)
        for dest,src in [(84,26),(88,27),(85,25),(89,25)]:
            cells[dest]=module(src,.23,1 if src==25 else .76)
    road_ids = [12,13,14,24,25,26,36,37,38,39,40,41,42]
    for i in road_ids:
        old = frame(original,i)
        # The old atlas supplies only an edge mask, never its confetti colors.
        mask = Image.new('L',(16,16))
        mask.putdata([255 if g>r*.95 and g>b*1.08 else 0 for r,g,b,a in old.get_flattened_data()])
        if i == 25:
            mask = Image.new('L',(16,16))
        cells[i] = Image.composite(frames[0],frames[3],mask)
    pairs = []
    for data in maps().values():
        ground = data['ground']
        for y,row in enumerate(ground):
            for x,a in enumerate(row):
                if x+1 < len(row): pairs.append((a,'R',row[x+1],'L'))
                if y+1 < len(ground): pairs.append((a,'B',ground[y+1][x],'T'))
    # Connect architectural modules, including roof rows and inset windows/doors.
    for data in maps().values():
        obj = data['objects']
        arch = set(mapping)-{0,1,2,5,15,16,18,28,29,30,83}
        for y,row in enumerate(obj):
            for x,a in enumerate(row):
                if a not in arch: continue
                if x+1<len(row) and row[x+1] in arch: pairs.append((a,'R',row[x+1],'L'))
                if y+1<len(obj) and obj[y+1][x] in arch: pairs.append((a,'B',obj[y+1][x],'T'))
    if revision:
        reconcile(cells,pairs)
    out = original.copy()
    for i,tile in enumerate(cells):
        out.paste(tile,(i%12*16,i//12*16))
    return out,pairs,mapping


def font(size):
    for path in ['/System/Library/Fonts/Menlo.ttc','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if Path(path).exists(): return ImageFont.truetype(path,size)
    return ImageFont.load_default()


def preview(frames, name, revision):
    im = Image.new('RGB',(1200,940),'#e4e0d1')
    d = ImageDraw.Draw(im)
    d.text((24,16),f'SHANHAI TERRAIN / {name} / 16 x 16 / 35 frames',font=font(19),fill='#26383a')
    for i,tile in enumerate(frames):
        x,y=24+i%12*98,60+i//12*125
        bg=Image.new('RGBA',(80,80),'#a5ac9a')
        bg.alpha_composite(tile.resize((80,80),Image.Resampling.NEAREST))
        im.paste(bg.convert('RGB'),(x,y))
        d.text((x,y+82),f'{i:02} {NAMES[i]}',font=font(9),fill='#26383a')
    d.text((24,445),'REPEAT TEST / grass variants, paving, animated water',font=font(16),fill='#26383a')
    for k,ids in enumerate([[0,1,2],[3],[6,7]]):
        patch=Image.new('RGBA',(128,96))
        for y in range(6):
            for x in range(8): patch.paste(frames[ids[(x+y)%len(ids)]],(16*x,16*y))
        im.paste(patch.resize((384,288),Image.Resampling.NEAREST).convert('RGB'),(16+k*396,480))
    d.text((24,785),'MODULE TEST / connected eaves, plaster wall, railing',font=font(16),fill='#26383a')
    for k,ids in enumerate([[18,19,19,20],[21,22,26,23],[28,29,29,30]]):
        patch=Image.new('RGBA',(64,16),'#9ba690')
        for x,i in enumerate(ids):patch.alpha_composite(frames[i],(16*x,0))
        im.paste(patch.resize((320,80),Image.Resampling.NEAREST).convert('RGB'),(24+k*396,825))
    im.save(MVP/'contact_sheet.png' if revision else ART/'contact_sheet_v1.png')


def map_preview(atlas, filename):
    data=maps()['town']
    h,w=len(data['ground']),len(data['ground'][0])
    im=Image.new('RGBA',(w*16,h*16),'#d8d2bf')
    for layer in ['ground','objects']:
        for y,row in enumerate(data[layer]):
            for x,i in enumerate(row):
                if i>=0: im.alpha_composite(frame(atlas,i),(16*x,16*y))
    im.resize((w*32,h*32),Image.Resampling.NEAREST).save(ART/filename)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--revision',type=int,choices=[0,1],default=0)
    args=parser.parse_args()
    frames=cut_art(args.revision)
    tile_sheet=sheet(frames)
    tile_sheet.save(MVP/'tiles.png' if args.revision else ART/'tiles_v1.png')
    preview(frames,'FINAL' if args.revision else 'V1',args.revision)
    atlas,pairs,mapping=runtime(frames,args.revision)
    atlas.save(ROOT/'public/assets/atlas_shanhai.png' if args.revision else ART/'atlas_v1.png')
    map_preview(atlas,'town_final.png' if args.revision else 'town_v1.png')
    if args.revision:
        manifest=json.loads((MVP/'manifest.json').read_text())
        manifest['sheets']['tiles'].update(count=35,names=NAMES)
        manifest['sheets']['tiles']['frames']={str(i):n for i,n in enumerate(NAMES)}
        manifest['tiles'].update(reeds=33,lantern=34)
        manifest['indexing']='zero-based, row-major; tile cell 35 is transparent padding'
        manifest['preview']={'file':'contact_sheet.png','width':1200,'height':940,
                             'scope':'terrain only; other sprite sheets unchanged'}
        manifest['sheets']['tiles']['palettePolicy']='muted mineral pigments; adaptive 32 colors per frame before edge reconciliation; unrelated sheets use legacy palette'
        manifest['legacyCompanionPalette']=manifest.get('legacyCompanionPalette',manifest['palette'])
        colors={tuple(c) for tile in frames for c in tile.get_flattened_data()}
        manifest['palette']=['#'+''.join(f'{v:02x}' for v in c) for c in sorted(colors)]
        manifest['aesthetic']={'source':'aesthetic/terrain_source.png',
            'groundSource':'aesthetic/ground_source_v2.png',
            'generator':'OpenAI built-in imagegen','postprocess':'scripts/build_aesthetic_tiles.py --revision 1',
            'runtimeFile':'../atlas_shanhai.png','runtimeMapping':{str(k):v for k,v in sorted(mapping.items())},
            'seams':'declared compatible pairs and all actual map ground/architecture adjacencies; exact RGBA equality'}
        (MVP/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        (ART/'seam_pairs.json').write_text(json.dumps({'mvp':surface_pairs(),'runtime':sorted(set(pairs))},indent=2)+'\n')
    print(f'Built revision={args.revision}: 35 active frames, 1 transparent padding cell')


if __name__=='__main__':main()
