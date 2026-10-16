#!/usr/bin/env python3
"""Build site/assets/fonts/study-mono-fill/StudyMonoFill.woff2.

Server Mono, the site's monospace, has no Greek, no maths symbols, no
arrows and no caret. In the study notes' hand-drawn figures and equations
those glyphs would fall back to a font with a different advance and push
every column after them out of line. This script takes the missing glyphs
from JetBrains Mono NL (SIL OFL 1.1, no reserved font name), scales them to
Server Mono's cap height, centres them on Server Mono's 630-unit advance and
gives them Server Mono's vertical metrics, so they sit on the same grid.
The angle sign (∠), which JetBrains Mono lacks, is drawn here.

    python tools/build-fill-font.py [path/to/JetBrainsMonoNL-Regular.ttf]

The source font is looked up in the usual Windows, macOS and Linux font
folders when no path is given. Requires fontTools and brotli.
"""
import os
import pathlib
import sys

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "assets" / "fonts" / "study-mono-fill" / "StudyMonoFill.woff2"
SERVER = ROOT / "site" / "assets" / "fonts" / "server-mono" / "ServerMono-Regular.woff2"

GLYPHS = (
    "αβγδεζηθικλμνξοπρστυφχψωΓΔΘΛΠΣΦΨΩ"
    "∫∑∏√∞≈≠≤≥±×÷∂∇∘−∈≡°′"
    "←→↑↓↔⇒^"
)
ANGLE = 0x2220  # ∠, drawn below

ADVANCE = 630  # Server Mono
ASCENT, DESCENT = 900, -200
FAMILY = "Study Mono Fill"


def find_source():
    if len(sys.argv) > 1:
        return pathlib.Path(sys.argv[1])
    name = "JetBrainsMonoNL-Regular.ttf"
    dirs = [
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Windows\Fonts"),
        r"C:\Windows\Fonts",
        os.path.expanduser("~/Library/Fonts"),
        "/Library/Fonts",
        os.path.expanduser("~/.local/share/fonts"),
        "/usr/share/fonts",
    ]
    for d in dirs:
        for p in pathlib.Path(d).rglob(name) if pathlib.Path(d).exists() else []:
            return p
    sys.exit(f"{name} not found; pass its path as the first argument")


def main():
    src = TTFont(find_source())
    server = TTFont(SERVER)
    scale = server["OS/2"].sCapHeight / src["OS/2"].sCapHeight
    cmap = src.getBestCmap()
    codepoints = [ord(c) for c in GLYPHS]
    missing = [chr(c) for c in codepoints if c not in cmap]
    if missing:
        sys.exit(f"source font lacks {''.join(missing)}")

    # Keep only the glyphs we need (plus .notdef), with no layout features.
    opts = Options()
    opts.layout_features = []
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    sub = Subsetter(opts)
    sub.populate(unicodes=codepoints)
    sub.subset(src)

    gs = src.getGlyphSet()
    glyf, hmtx = src["glyf"], src["hmtx"]
    for name in src.getGlyphOrder():
        rec = DecomposingRecordingPen(gs)
        gs[name].draw(rec)
        width = hmtx[name][0] * scale
        dx = (ADVANCE - width) / 2
        pen = TTGlyphPen(None)
        rec.replay(TransformPen(pen, (scale, 0, 0, scale, dx, 0)))
        glyf[name] = pen.glyph()
        hmtx[name] = (ADVANCE, 0)

    # ∠: a horizontal base and a rising stroke, the weight of the
    # neighbouring maths glyphs (about 70 units at this scale).
    stroke = 70
    left, right, base, top = 95, 540, 0, 560
    # Clockwise, as TrueType wants outer contours.
    pen = TTGlyphPen(None)
    pen.moveTo((left, base))
    pen.lineTo((right - 75, top + 40))
    pen.lineTo((right - 20, top))
    pen.lineTo((left + 128, base + stroke))
    pen.lineTo((right, base + stroke))
    pen.lineTo((right, base))
    pen.closePath()
    glyf["angle"] = pen.glyph()  # also appends it to the shared glyph order
    hmtx["angle"] = (ADVANCE, 0)
    for table in src["cmap"].tables:
        if table.isUnicode():
            table.cmap[ANGLE] = "angle"
    src["maxp"].numGlyphs = len(src.getGlyphOrder())
    if "post" in src:
        src["post"].formatType = 3.0

    for name in src.getGlyphOrder():
        glyf[name].recalcBounds(glyf)
    head = src["head"]
    head.xMin = min(g.xMin for g in (glyf[n] for n in src.getGlyphOrder()) if hasattr(g, "xMin"))
    head.xMax = max(g.xMax for g in (glyf[n] for n in src.getGlyphOrder()) if hasattr(g, "xMax"))

    hhea, os2 = src["hhea"], src["OS/2"]
    hhea.ascent, hhea.descent, hhea.lineGap = ASCENT, DESCENT, 0
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ASCENT, DESCENT, 0
    os2.usWinAscent, os2.usWinDescent = ASCENT, -DESCENT
    os2.xAvgCharWidth = ADVANCE
    hhea.advanceWidthMax = ADVANCE

    name = src["name"]
    copyright_ = name.getDebugName(0)
    name.names = []
    for nid, value in {
        0: f"{copyright_}. Subset and rescaled for seory0.github.io/study.",
        1: FAMILY,
        2: "Regular",
        3: f"{FAMILY} Regular",
        4: f"{FAMILY} Regular",
        5: "Version 1.000",
        6: "StudyMonoFill-Regular",
        13: "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
        14: "https://openfontlicense.org",
    }.items():
        name.setName(value, nid, 3, 1, 0x409)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    src.flavor = "woff2"
    src.save(OUT)
    print(f"{OUT.relative_to(ROOT)}: {len(src.getGlyphOrder())} glyphs, {OUT.stat().st_size} bytes, scale {scale:.4f}")


if __name__ == "__main__":
    main()
