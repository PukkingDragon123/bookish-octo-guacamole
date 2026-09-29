"""Slice a puppet-part sheet (parts laid out on a baked-in transparency
checkerboard) into individual sprite PNGs with clean alpha.

Usage: python3 tools/slice_sheet.py <sheet.jpg> <out_dir> [min_area] [rig.json]

Writes one PNG per connected part plus parts.json (bbox + detected pivot
holes in sheet coordinates) and _debug.png with component labels. With a
rig config, parts are renamed, optionally split, and joint rivets are
painted at the listed sheet coordinates (this also fills pivot holes that
the background flood-fill opened up at part edges).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
min_area = int(sys.argv[3]) if len(sys.argv) > 3 else 900
rig = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else None
os.makedirs(out, exist_ok=True)

rgb = np.array(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = rgb.shape
lum = rgb.mean(2)
sat = rgb.max(2) - rgb.min(2)

# Checkerboard squares are ~252 and ~215 grey with JPEG noise.
bg_like = (sat < 26) & (lum > 180)
# Flood-fill background from the image border only, so white perforation
# dots enclosed by leather stay part of the puppet.
lab, n = ndi.label(bg_like)
border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
bg = np.isin(lab, border[border > 0])
# Close tiny gaps where JPEG noise broke the checker connectivity.
bg = ndi.binary_opening(bg, iterations=1) | (bg & ~ndi.binary_erosion(~bg, iterations=1))

fg = ~bg
# Floating grey pivot markers (lum ~95, unsaturated) sit between parts.
grey = (sat < 28) & (lum > 62) & (lum < 175)
core = fg & ~grey
core = ndi.binary_opening(core, iterations=1)
lab, n = ndi.label(core)
areas = ndi.sum(core, lab, range(1, n + 1))
keep = [i + 1 for i, a in enumerate(areas) if a >= min_area]
print(f"{n} components, keeping {len(keep)}")

# Soft alpha along the boundary: estimate coverage from luminance against
# the local checker value.
dist_bg = ndi.distance_transform_edt(~bg)
bg_ref = np.where(((np.arange(W)[None, :] // 8) + (np.arange(H)[:, None] // 8)) % 2 == 0, 252.0, 215.0)
ink = 32.0
edge_alpha = np.clip((bg_ref - lum) / (bg_ref - ink), 0, 1)

parts = []
dbg = Image.fromarray(rgb.astype(np.uint8)).convert("RGBA")
draw = ImageDraw.Draw(dbg)
for k, idx in enumerate(keep):
    m = lab == idx
    # grow back the anti-aliased rim (2px) but stay inside the foreground
    grown = ndi.binary_dilation(m, iterations=3) & fg & ~(grey & ~ndi.binary_dilation(m, iterations=1))
    ys, xs = np.nonzero(grown)
    pad = 6
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, W)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, H)
    sub = grown[y0:y1, x0:x1]
    d = dist_bg[y0:y1, x0:x1]
    a = np.where(d > 2.5, 1.0, edge_alpha[y0:y1, x0:x1]) * sub
    a = ndi.gaussian_filter(a, 0.45)
    col = rgb[y0:y1, x0:x1].copy()
    # Un-mix the checker from rim pixels so edges don't glow light grey.
    br = bg_ref[y0:y1, x0:x1][..., None]
    aa = np.clip(a, 0.05, 1)[..., None]
    rim = (d <= 2.5)[..., None]
    unmixed = np.clip((col - br * (1 - aa)) / aa, 0, 255)
    col = np.where(rim, unmixed, col)

    # Pivot holes: enclosed light-grey disks (r~5-8px) -> fill as dark rivet.
    lightgrey = (sat[y0:y1, x0:x1] < 24) & (lum[y0:y1, x0:x1] > 150) & sub & (d > 1.0)
    hl, hn = ndi.label(lightgrey)
    pivots = []
    for h in range(1, hn + 1):
        hm = hl == h
        ar = hm.sum()
        if 45 <= ar <= 260:
            hy, hx = np.nonzero(hm)
            w_, h_ = np.ptp(hx) + 1, np.ptp(hy) + 1
            if 0.6 < w_ / h_ < 1.6 and ar > 0.55 * w_ * h_:
                cx, cy = hx.mean(), hy.mean()
                pivots.append([round(float(cx + x0), 1), round(float(cy + y0), 1)])
                ring = ndi.binary_dilation(hm, iterations=2)
                col[ring] = [38, 30, 26]
    name = f"part{k:02d}"
    pieces = [(name, x0, x1, col, a)]
    if rig:
        name = rig["names"].get(name, name)
        pieces = [(name, x0, x1, col, a)]
        sp = rig.get("split", {}).get(name)
        if sp:
            cx = sp["x"] - x0
            pieces = [(name, x0, x0 + cx + 6, col[:, : cx + 6], a[:, : cx + 6] * np.clip((cx + 6 - np.arange(cx + 6)) / 6.0, 0, 1)[None, :]),
                      (sp["right"], x0 + cx - 6, x1, col[:, cx - 6 :], a[:, cx - 6 :] * np.clip(np.arange(x1 - x0 - cx + 6) / 6.0, 0, 1)[None, :])]
    for pname, px0, px1, pcol, pa in pieces:
        pcol = pcol.copy()
        pa = pa.copy()
        hh, ww = pa.shape
        yy, xx = np.mgrid[0:hh, 0:ww]
        for rx, ry in (rig or {}).get("rivets", {}).get(pname, []):
            lx, ly = rx - px0, ry - y0
            d2 = np.hypot(xx - lx, yy - ly)
            disk = d2 <= 7.5
            pcol[disk] = [34, 26, 21]
            ring = (d2 > 5.2) & (d2 <= 7.5)
            pcol[ring] = [120, 92, 48]
            pcol[(d2 <= 2.2)] = [70, 56, 40]
            pa[d2 <= 8.2] = np.maximum(pa[d2 <= 8.2], np.clip(8.2 - d2[d2 <= 8.2], 0, 1))
        # trim empty columns left by splitting
        cols = np.nonzero(pa.max(0) > 0.01)[0]
        c0, c1 = max(cols.min() - 4, 0), min(cols.max() + 5, ww)
        rgba = np.dstack([pcol[:, c0:c1], pa[:, c0:c1] * 255]).astype(np.uint8)
        Image.fromarray(rgba, "RGBA").save(os.path.join(out, pname + ".png"))
        parts.append({"name": pname, "x": int(px0 + c0), "y": int(y0), "w": int(c1 - c0), "h": int(y1 - y0), "pivots": pivots})
    draw.rectangle([x0, y0, x1, y1], outline=(0, 160, 255, 255), width=2)
    draw.text((x0 + 4, y0 + 2), name, fill=(0, 0, 255, 255))
    for rx, ry in [pt for pl in (rig or {}).get("rivets", {}).values() for pt in pl]:
        draw.ellipse([rx - 4, ry - 4, rx + 4, ry + 4], fill=(0, 255, 0, 255))
    for px, py in pivots:
        draw.ellipse([px - 5, py - 5, px + 5, py + 5], outline=(255, 0, 255, 255), width=2)

with open(os.path.join(out, "parts.json"), "w") as f:
    json.dump({"sheet": os.path.basename(src), "w": W, "h": H,
               "parts": {p["name"]: [p["x"], p["y"], p["w"], p["h"]] for p in parts}}, f, indent=1)
dbg.save(os.path.join(out, "_debug.png"))
