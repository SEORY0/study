#!/usr/bin/env python3
"""Lint the notes in studies/ before committing.

    python tools/lint.py             # every note
    python tools/lint.py phasor      # only notes whose slug matches

Checks the front matter against site/_data/study.yml, the typography rules
(no em or en dashes, nothing Liquid or kramdown would execute), the links
between notes, and the two hand-drawn block types:

  ```ascii   figures      ```eq   display equations

Inside those blocks only glyphs the site's monospace stack draws at one
width are allowed (Server Mono plus the Study Mono Fill subset), so every
column lines up. Hangul is proportional on this site: it may close an
`ascii` line (a trailing label) but never sit in front of aligned glyphs,
and never appears in an `eq` block.

Last, the note index in README.md must match what tools/readme.py writes.

Exit status 1 if any error was found. Warnings do not fail.
"""
import pathlib
import re
import sys
import unicodedata

import readme

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOTES = ROOT / "studies"
DATA = ROOT / "site" / "_data" / "study.yml"

KEYS = ["title", "short", "order", "summary", "threads", "date"]
MAX_COLS = 56

SERVER_MONO = (
    "─│┌┐└┘├┤┬┴┼╭╮╰╯═║╔╗╚╝╠╣╦╩╬━┃┏┓┗┛┣┫┳┻╋╌╎┄┆"
    "▶◀▲▼●○•·■□…"
    "▁▂▃▄▅▆▇█░▒▓"
    "⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉"
)
FILL = (
    "αβγδεζηθικλμνξοπρστυφχψωΓΔΘΛΠΣΦΨΩ"
    "∫∑∏√∞≈≠≤≥±×÷∠∂∇∘−∈≡°′"
    "←→↑↓↔⇒^"
)
ALLOWED = set(chr(c) for c in range(0x20, 0x7F)) | set(SERVER_MONO) | set(FILL)


def is_hangul(ch):
    return "HANGUL" in unicodedata.name(ch, "")


def cols(s):
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def load_data():
    """Tiny reader for site/_data/study.yml: subject ids and thread ids only."""
    subjects, threads, section = [], [], None
    areas = []
    for line in DATA.read_text(encoding="utf-8").splitlines():
        if re.match(r"^\w+:\s*$", line):
            section = line.split(":")[0]
        m = re.match(r"^  - id:\s*(\S+)", line)
        if m:
            {"areas": areas, "subjects": subjects, "threads": threads}[section].append(m.group(1))
    return subjects, threads


def front_matter(text):
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None, text
    fm = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        fm[k.strip()] = v.strip()
    return fm, text[m.end():]


def main(argv):
    sys.stdout.reconfigure(encoding="utf-8")
    subjects, threads = load_data()
    every = sorted(NOTES.rglob("*.md"))
    files = every
    slugs = {f.stem for f in every}
    if len(argv) > 1:
        files = [f for f in files if any(a in f.stem for a in argv[1:])]
    errors = warnings = 0

    def err(f, n, msg):
        nonlocal errors
        errors += 1
        print(f"ERROR {f.relative_to(ROOT)}:{n}: {msg}")

    def warn(f, n, msg):
        nonlocal warnings
        warnings += 1
        print(f"warn  {f.relative_to(ROOT)}:{n}: {msg}")

    for f in files:
        text = f.read_text(encoding="utf-8").replace("\r\n", "\n")
        if len(f.relative_to(NOTES).parts) != 2:
            err(f, 1, "a note lives at studies/<subject>/<slug>.md, one folder deep")
            continue
        if f.parent.name not in subjects:
            err(f, 1, f"folder '{f.parent.name}' is not a subject id in site/_data/study.yml")
        if f.stem == "index" or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", f.stem):
            err(f, 1, "file name must be a lowercase slug (a-z, 0-9, -) and not 'index'")
        if sum(g.stem == f.stem for g in every) > 1:
            err(f, 1, f"slug '{f.stem}' is used in more than one subject")
        fm, body = front_matter(text)
        if fm is None:
            err(f, 1, "no front matter")
            continue
        if list(fm) != KEYS:
            err(f, 1, f"front matter keys must be exactly {KEYS}, got {list(fm)}")
        short = fm.get("short", "")
        hangul = sum(is_hangul(c) for c in short)
        if hangul > 10 or (hangul == 0 and len(short) > 16):
            err(f, 1, f"short '{short}' is too long for the map")
        if not re.fullmatch(r"\d+", fm.get("order", "")):
            err(f, 1, "order must be an integer")
        if fm.get("summary", "").endswith("."):
            err(f, 1, "summary must not end with a period")
        for t in re.findall(r"[\w-]+", fm.get("threads", "")):
            if t not in threads:
                err(f, 1, f"unknown thread '{t}'")

        lines = text.split("\n")
        fence = None
        h2 = []
        for n, line in enumerate(lines, 1):
            if "—" in line or "–" in line:
                err(f, n, "em or en dash (use a comma, colon, parentheses or ·)")
            if "{{" in line or "{%" in line:
                err(f, n, "'{{' or '{%' would run as Liquid")
            if "$$" in line:
                err(f, n, "'$$' would start kramdown math")
            m = re.match(r"^```(\w*)\s*$", line)
            if m:
                fence = None if fence else (m.group(1) or "code")
                continue
            if fence in ("ascii", "eq"):
                bad = sorted({c for c in line if c not in ALLOWED and not is_hangul(c)})
                if bad:
                    err(f, n, f"glyphs outside the mono set in ```{fence}: {''.join(bad)}")
                if any(is_hangul(c) for c in line):
                    if fence == "eq":
                        err(f, n, "Hangul inside an eq block")
                    else:
                        first = next(i for i, c in enumerate(line) if is_hangul(c))
                        tail = line[first:]
                        if any(c in SERVER_MONO + FILL + "|/\\_" for c in tail if not is_hangul(c) and c != " "):
                            err(f, n, "Hangul must only close an ascii line (aligned glyphs follow it)")
                if cols(line) > MAX_COLS:
                    warn(f, n, f"{cols(line)} columns (max {MAX_COLS})")
                if "\t" in line:
                    err(f, n, "tab inside a figure")
                continue
            if fence:
                continue
            if line.startswith("## "):
                h2.append(line[3:].strip())
            for slug in re.findall(r"\]\(/study/([^/)#]+)/?[^)]*\)", line):
                if slug not in slugs:
                    err(f, n, f"link to unknown note '/study/{slug}/'")
            prose = re.sub(r"`[^`]*`", "", line)
            if re.search(r"\w\*\w", prose):
                warn(f, n, "'*' between words reads as emphasis; use ∗ (U+2217)")
            if line.startswith("|"):
                warn(f, n, "line starts with '|' (table)")
        if fence:
            err(f, len(lines), "unclosed code fence")
        if not h2 or h2[-1] != "이어지는 곳":
            err(f, len(lines), "last ## section must be '이어지는 곳'")

    want = readme.expected()
    if want is None:
        errors += 1
        print(f"ERROR README.md: the index marker line is missing:\n{readme.MARKER}")
    elif want != readme.README.read_text(encoding="utf-8").replace("\r\n", "\n"):
        errors += 1
        print("ERROR README.md: the note index is stale, run python tools/readme.py")

    print(f"{len(files)} notes, {errors} errors, {warnings} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
