#!/usr/bin/env python3
"""The share preview (Open Graph / Twitter card), 1200 x 630.

    python docs/og-image.py      # writes assets/og.png

Dark like the main site's card: the STUDY wordmark in the home banner's
block letters, the e^(jωt) thread under it, and on the right that thread's
route as the map draws it, a staircase down five subjects. Glyphs are
Server Mono, placed one by one on a whole-pixel grid so the blocks and box
lines join; the Hangul labels use Noto Sans KR from the system (only
rendered into the image, not shipped).
"""
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MONO = ROOT / "assets/fonts/server-mono/ServerMono-Regular.woff2"
FILL = ROOT / "assets/fonts/study-mono-fill/StudyMonoFill.woff2"
HANGUL = Path(r"C:\Windows\Fonts\NotoSansKR-VF.ttf")
OUT = ROOT / "assets/og.png"

W, H = 1200, 630
PAPER, INK, MUTE = 12, 232, 138          # the site's dark theme

BANNER = [
    "███████╗████████╗██╗   ██╗██████╗ ██╗   ██╗",
    "██╔════╝╚══██╔══╝██║   ██║██╔══██╗╚██╗ ██╔╝",
    "███████╗   ██║   ██║   ██║██║  ██║ ╚████╔╝ ",
    "╚════██║   ██║   ██║   ██║██║  ██║  ╚██╔╝  ",
    "███████║   ██║   ╚██████╔╝██████╔╝   ██║   ",
    "╚══════╝   ╚═╝    ╚═════╝ ╚═════╝    ╚═╝   ",
]

# The e^(jωt) route: (glyphs, label). Labels are subject headings (bold)
# or notes.
ROUTE = [
    ("╷", ("공학수학", True)),
    ("●", ("오일러 공식", False)),
    ("╰───╮", ("신호및시스템", True)),
    ("    ●", ("복소지수와 고유함수", False)),
    ("    ╰───╮", ("회로망해석", True)),
    ("        ●", ("페이저", False)),
    ("        │", None),
    ("        ●", ("임피던스", False)),
    ("        ╰───╮", ("전자회로", True)),
    ("            ●", ("보드 선도", False)),
    ("            ╰───╮", ("통신", True)),
    ("                ●", ("OFDM", False)),
]


MONO_CMAP = set(TTFont(MONO).getBestCmap())


def grid_text(draw, x, y, text, font, adv, fill, fallback=None):
    """One glyph per cell; what Server Mono lacks comes from the fill font."""
    for i, ch in enumerate(text):
        if ch == " ":
            continue
        f = font if fallback is None or ord(ch) in MONO_CMAP else fallback
        draw.text((x + i * adv, y), ch, font=f, fill=fill)


def main():
    card = Image.new("L", (W, H), PAPER)
    d = ImageDraw.Draw(card)

    # Wordmark: drawn big on an integer grid, then scaled into place.
    px = 40
    big = ImageFont.truetype(str(MONO), px)
    adv = round(big.getlength("M"))
    step = px
    asc, desc = big.getmetrics()
    top = (step - (asc + desc)) // 2
    bw, bh = len(BANNER[0]) * adv, len(BANNER) * step
    im = Image.new("L", (bw, bh), PAPER)
    bd = ImageDraw.Draw(im)
    for r, line in enumerate(BANNER):
        grid_text(bd, 0, r * step + top, line, big, adv, INK)
    target_w = 560
    im = im.resize((target_w, round(bh * target_w / bw)), Image.LANCZOS)
    left, y0 = 72, 92
    card.paste(im, (left, y0))

    # Thread mark and line under the wordmark.
    mono = ImageFont.truetype(str(MONO), 26)
    fill = ImageFont.truetype(str(FILL), 26)
    kr = ImageFont.truetype(str(HANGUL), 25)
    kr_small = ImageFont.truetype(str(HANGUL), 22)
    y = y0 + im.height + 56
    madv = round(mono.getlength("M"))
    grid_text(d, left, y, "e^(jωt)", mono, madv, INK, fallback=fill)
    d.text((left + 9 * madv, y - 2), "복소지수", font=kr, fill=INK)
    y += 48
    for line in ("미분해도 모양이 변하지 않는 함수 하나가", "회로를 지나 통신까지 간다"):
        d.text((left, y), line, font=kr_small, fill=MUTE)
        y += 36
    d.text((left, H - 72), "seory0.github.io/study", font=ImageFont.truetype(str(MONO), 22), fill=MUTE)

    # The route, on the map's grid: line height 1.25 so the box lines meet.
    rp = 22
    rf = ImageFont.truetype(str(MONO), rp)
    radv = round(rf.getlength("M"))
    rstep = round(rp * 1.25)
    rasc, rdesc = rf.getmetrics()
    rtop = (rstep - (rasc + rdesc)) // 2
    lab_bold = ImageFont.truetype(str(HANGUL), 20)
    lab = ImageFont.truetype(str(HANGUL), 20)
    try:
        lab_bold.set_variation_by_axes([700])
        lab.set_variation_by_axes([400])
    except Exception:
        pass
    rx = 700
    ry = (H - len(ROUTE) * rstep * 1.0) // 2 - 6
    cols = 17
    for r, (glyphs, label) in enumerate(ROUTE):
        yy = ry + r * rstep
        grid_text(d, rx, yy + rtop, glyphs, rf, radv, INK)
        # the hairline that runs a lane through its dots, as on the site
        for c, ch in enumerate(glyphs):
            if ch == "●":
                cx = rx + c * radv + radv // 2
                above = r > 0 and len(ROUTE[r - 1][0]) > c and ROUTE[r - 1][0][c] in "│╮╷●"
                below = r + 1 < len(ROUTE) and len(ROUTE[r + 1][0]) > c and ROUTE[r + 1][0][c] in "│●╰"
                if above:
                    d.line([(cx, yy), (cx, yy + rstep // 2)], fill=INK, width=2)
                if below:
                    d.line([(cx, yy + rstep // 2), (cx, yy + rstep)], fill=INK, width=2)
        if label:
            text, bold = label
            d.text((rx + cols * radv + 18, yy + 1), text, font=lab_bold if bold else lab, fill=INK)

    card.save(OUT, optimize=True)
    print(f"{OUT.relative_to(ROOT)}: {W}x{H}")


if __name__ == "__main__":
    main()
