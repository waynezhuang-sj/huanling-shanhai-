#!/usr/bin/env python3
"""Check delivered pixels, frame semantics, actual map joins and src hashes."""
import hashlib
import json
from PIL import Image
from build_aesthetic_tiles import ROOT, MVP, ART, NAMES, frame, maps, surface_pairs


def edge(im, side):
    coords={'L':[(0,y) for y in range(16)],'R':[(15,y) for y in range(16)],
            'T':[(x,0) for x in range(16)],'B':[(x,15) for x in range(16)]}[side]
    return [im.getpixel(p) for p in coords]


def main():
    report=[]
    def check(ok, text):
        report.append(('PASS ' if ok else 'FAIL ')+text)
        if not ok: raise AssertionError(text)
    manifest=json.loads((MVP/'manifest.json').read_text())
    im=Image.open(MVP/'tiles.png').convert('RGBA')
    spec=manifest['sheets']['tiles']
    check(im.size==(192,48),'tiles.png 192x48, 12 columns, 16x16 cells')
    check(spec['count']==len(spec['names'])==len(spec['frames'])==35,'35 named active frames match manifest')
    check(spec['names']==NAMES,'frame names exactly match delivered ordering')
    frames=[frame(im,i) for i in range(36)]
    for i in range(35):check(frames[i].getchannel('A').getbbox() is not None,f'frame {i:02} {NAMES[i]} contains pixels')
    check(frames[35].getchannel('A').getbbox() is None,'padding frame 35 transparent')
    for i in range(8):check(frames[i].getchannel('A').getextrema()==(255,255),f'ground frame {i} fully opaque')
    for i in [8,9,10,11,12,13,14,15,16,17,31,32,33,34]:
        check(all(p[3]==0 for s in 'LRTB' for p in edge(frames[i],s)),f'object frame {i} clear perimeter')
    def seams(cells,pairs,label):
        for a,sa,b,sb in sorted(set(tuple(p) for p in pairs)):
            check(edge(cells[a],sa)==edge(cells[b],sb),f'{label} seam {a}.{sa} = {b}.{sb} RGBA exact')
    seams(frames,surface_pairs(),'MVP')
    atlas=Image.open(ROOT/'public/assets/atlas_shanhai.png').convert('RGBA')
    original=Image.open(ART/'atlas_before.png').convert('RGBA')
    check(atlas.size==original.size==(192,352),'runtime atlas dimensions and indexing unchanged')
    cells=[frame(atlas,i) for i in range(264)]
    pairs=[]
    ground_count=0
    for data in maps().values():
        g=data['ground']
        for y,row in enumerate(g):
            for x,a in enumerate(row):
                if x+1<len(row):pairs.append((a,'R',row[x+1],'L'));ground_count+=1
                if y+1<len(g):pairs.append((a,'B',g[y+1][x],'T'));ground_count+=1
    seams(cells,pairs,'runtime ground')
    report.append(f'PASS {ground_count} actual map ground adjacencies represented above')
    declared=json.loads((ART/'seam_pairs.json').read_text())
    seams(cells,declared['runtime'],'runtime all declared')
    for filename in ['hero.png','npc.png','creatures.png','ui.png']:
        check(Image.open(MVP/filename).format=='PNG',f'unmodified companion PNG opens: {filename}')
    for filename in ['contact_sheet_v1.png','town_v1.png','town_final.png']:
        check((ART/filename).is_file(),f'visual evidence saved: {filename}')
    check((ART/'tiles_v1.png').read_bytes()!=(MVP/'tiles.png').read_bytes(),'V1 and final have actual pixel differences')
    baseline=json.loads((ART/'src_baseline.json').read_text())
    now={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'src').rglob('*') if p.is_file()}
    check(baseline==now,'all src/** files byte-for-byte unchanged, no additions/removals')
    report.append('NOTE: edge equality is a mechanical check; visual review is recorded in docs/美术说明.md.')
    (MVP/'verification.txt').write_text('\n'.join(report)+'\n')
    print('\n'.join(report))


if __name__=='__main__':main()
