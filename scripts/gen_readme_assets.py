"""
Builds the images the README uses, into `docs/`.

  python scripts/gen_readme_assets.py

Two jobs:
  1. Compress the raw storefront screenshots handed to it into web-sized JPEGs.
  2. Draw `palette.png` straight from the design tokens below, so the swatch
     strip in the README can never drift from `app/globals.css`.

Screenshots are passed in on the command line:
  python scripts/gen_readme_assets.py banner=<path> about=<path>
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

# Mirrors the @theme block in app/globals.css
PALETTE = [
    ("Ink", "#2a1b33"),
    ("Ink Soft", "#5a4d66"),
    ("Muted", "#786a85"),
    ("Line", "#e5dcf0"),
    ("Lilac", "#f4effa"),
    ("Frost", "#faf7fd"),
    ("Purple", "#5e2b8a"),
    ("Aubergine", "#3d1c56"),
    ("Sale", "#b3261e"),
    ("Jade", "#2f6b4f"),
]

SERIF = "C:/Windows/Fonts/georgia.ttf"
SANS = "C:/Windows/Fonts/segoeui.ttf"

TARGET_WIDTH = 1400
JPEG_QUALITY = 84


def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def compress(src: Path, dest: Path) -> None:
    """Downscale to README width and re-encode as JPEG."""
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > TARGET_WIDTH:
            height = round(im.height * TARGET_WIDTH / im.width)
            im = im.resize((TARGET_WIDTH, height), Image.LANCZOS)
        im.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    kb = dest.stat().st_size / 1024
    print(f"  {dest.relative_to(ROOT)}  {im.width}x{im.height}  {kb:.0f} KB")


def hex_to_rgb(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def draw_palette(dest: Path) -> None:
    """A swatch strip in the storefront's own idiom: hairlines, wide-tracked caps."""
    scale = 2  # drawn at 2x, downsampled for crisp edges
    cols = len(PALETTE)
    cell_w, chip_h = 140 * scale, 96 * scale
    pad = 28 * scale
    text_h = 52 * scale

    width = cols * cell_w + pad * 2
    height = chip_h + text_h + pad * 2

    cream = hex_to_rgb("#fbf9f6")
    ink = hex_to_rgb("#1b1a18")
    muted = hex_to_rgb("#8b847b")
    line = hex_to_rgb("#e4ded4")

    im = Image.new("RGB", (width, height), cream)
    d = ImageDraw.Draw(im)

    name_font = load_font(SANS, 11 * scale)
    hex_font = load_font(SANS, 10 * scale)

    for i, (name, hex_value) in enumerate(PALETTE):
        x = pad + i * cell_w
        chip = [x, pad, x + cell_w - 10 * scale, pad + chip_h]
        d.rectangle(chip, fill=hex_to_rgb(hex_value))
        # Pale chips need an outline or they vanish into the ground
        if hex_value.lower() in ("#fbf9f6", "#f5f1ea", "#e4ded4"):
            d.rectangle(chip, outline=line, width=scale)

        label = " ".join(name.upper())  # fake the .eyebrow letter-spacing
        d.text((x, pad + chip_h + 14 * scale), label, font=name_font, fill=ink)
        d.text(
            (x, pad + chip_h + 32 * scale),
            hex_value.upper(),
            font=hex_font,
            fill=muted,
        )

    # Hairline rule top and bottom, as on the site
    d.line([(0, 0), (width, 0)], fill=line, width=scale)
    d.line([(0, height - scale), (width, height - scale)], fill=line, width=scale)

    im = im.resize((width // scale, height // scale), Image.LANCZOS)
    im.save(dest, "PNG", optimize=True)
    print(f"  {dest.relative_to(ROOT)}  {im.width}x{im.height}  "
          f"{dest.stat().st_size / 1024:.0f} KB")


def main() -> None:
    DOCS.mkdir(exist_ok=True)
    print("Writing README assets:")

    for arg in sys.argv[1:]:
        if "=" not in arg:
            continue
        name, src = arg.split("=", 1)
        src_path = Path(src)
        if not src_path.exists():
            print(f"  !! missing source for {name}: {src}")
            continue
        compress(src_path, DOCS / f"{name}.jpg")

    draw_palette(DOCS / "palette.png")


if __name__ == "__main__":
    main()
