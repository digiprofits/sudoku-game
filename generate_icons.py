"""
Generate icons/icon-192.png and icons/icon-512.png from the SVG design.

Requires Pillow:  pip install Pillow
Optionally uses cairosvg for a higher-fidelity SVG render:  pip install cairosvg
(cairosvg also needs the native Cairo DLL on Windows — Pillow is the safe fallback.)

Usage:
    python generate_icons.py
"""

import os
import sys

ICONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
SVG_PATH = os.path.join(ICONS_DIR, "icon.svg")

# ---------------------------------------------------------------------------
# Try cairosvg first (faithful SVG render)
# ---------------------------------------------------------------------------
try:
    import cairosvg  # noqa: F401 — imported for side-effect check

    for size in [192, 512]:
        out = os.path.join(ICONS_DIR, f"icon-{size}.png")
        cairosvg.svg2png(url=SVG_PATH, write_to=out, output_width=size, output_height=size)
        print(f"[cairosvg] {out}")
    sys.exit(0)
except Exception:
    pass  # fall through to Pillow

# ---------------------------------------------------------------------------
# Pillow fallback — draw the design directly
# ---------------------------------------------------------------------------
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("ERROR: Pillow is required.  Run:  pip install Pillow", file=sys.stderr)
    sys.exit(1)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size / 512  # scale factor

    # Blue rounded background (#2563eb)
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=int(80 * s),
        fill=(37, 99, 235, 255),
    )

    # Board inset: 392×392 at (60,60) in 512-space
    gx, gy, gw = int(60 * s), int(60 * s), int(392 * s)

    # Subtle semi-transparent board background
    draw.rounded_rectangle(
        [gx, gy, gx + gw, gy + gw], radius=int(8 * s), fill=(255, 255, 255, 20)
    )

    # Outer border
    draw.rounded_rectangle(
        [gx, gy, gx + gw, gy + gw],
        radius=int(8 * s),
        outline=(255, 255, 255, 255),
        width=max(1, int(10 * s)),
    )

    # Major box-separator lines (thick white) at x/y = 191 and 321
    thick = max(1, int(8 * s))
    for v in [191, 321]:
        xi = int(v * s)
        draw.line([(xi, gy), (xi, gy + gw)], fill=(255, 255, 255, 255), width=thick)
        draw.line([(gx, xi), (gx + gw, xi)], fill=(255, 255, 255, 255), width=thick)

    # Inner cell lines (faint) at the 6 inner positions per axis
    thin = max(1, int(2 * s))
    for v in [104, 147, 235, 278, 365, 408]:
        xi = int(v * s)
        draw.line([(xi, gy), (xi, gy + gw)], fill=(255, 255, 255, 89), width=thin)
        draw.line([(gx, xi), (gx + gw, xi)], fill=(255, 255, 255, 89), width=thin)

    # Sample digits — try bold system fonts
    fsize = max(8, int(30 * s))
    font = None
    for path in [
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\calibrib.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, fsize)
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()

    # (col, row, digit) — cell centre = 60 + (n + 0.5) × 43.56 in 512-space
    cell = 392 / 9
    for col, row, digit in [
        (0, 0, "5"), (4, 1, "3"), (8, 2, "7"),
        (2, 4, "9"), (5, 6, "4"), (1, 8, "2"),
    ]:
        cx = int((60 + (col + 0.5) * cell) * s)
        cy = int((60 + (row + 0.5) * cell) * s)
        bb = draw.textbbox((0, 0), digit, font=font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        draw.text(
            (cx - tw // 2 - bb[0], cy - th // 2 - bb[1]),
            digit,
            fill=(255, 255, 255, 255),
            font=font,
        )

    return img


for sz in [192, 512]:
    img = make_icon(sz)
    out = os.path.join(ICONS_DIR, f"icon-{sz}.png")
    img.save(out, "PNG")
    print(f"[pillow]   {out}")
