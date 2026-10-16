#!/usr/bin/env python3
"""Write the note index at the end of README.md.

    python tools/readme.py

Everything after the marker line in README.md is rewritten: one section per
subject in the order of site/_data/study.yml (subjects with no notes are
left out), headed by the subject's English name, its notes by `order`, each
linking to its page on the site. tools/lint.py reports the index as stale
when it differs from what this script would write.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
NOTES = ROOT / "studies"
DATA = ROOT / "site" / "_data" / "study.yml"
CONFIG = ROOT / "_config.yml"
MARKER = "<!-- 아래 목록은 python tools/readme.py가 studies/에서 만든다. 손으로 고치지 않는다. -->"


def unquote(v):
    v = v.strip()
    return v[1:-1] if len(v) > 1 and v[0] == v[-1] and v[0] in "\"'" else v


def subjects():
    """(id, en) for each subject in site/_data/study.yml, in order."""
    out, section = [], None
    for line in DATA.read_text(encoding="utf-8").splitlines():
        if re.match(r"^\w+:\s*$", line):
            section = line.split(":")[0]
        if section != "subjects":
            continue
        m = re.match(r"^  - id:\s*(\S+)", line)
        if m:
            out.append([m.group(1), m.group(1)])
        m = re.match(r"^    en:\s*(.+)$", line)
        if m and out:
            out[-1][1] = unquote(m.group(1))
    return [tuple(s) for s in out]


def site_url():
    cfg = CONFIG.read_text(encoding="utf-8")
    get = lambda k: unquote(re.search(rf"(?m)^{k}:\s*(.+)$", cfg).group(1))
    return get("url").rstrip("/") + get("baseurl").rstrip("/")


def title_and_order(path):
    m = re.match(r"^---\n(.*?)\n---\n", path.read_text(encoding="utf-8").replace("\r\n", "\n"), re.S)
    fm = dict(line.partition(":")[::2] for line in m.group(1).splitlines()) if m else {}
    fm = {k.strip(): unquote(v) for k, v in fm.items()}
    order = int(fm["order"]) if re.fullmatch(r"\d+", fm.get("order", "")) else 0
    return fm.get("title") or path.stem, order


def index():
    base, out = site_url(), []
    for sid, en in subjects():
        notes = []
        for f in (NOTES / sid).glob("*.md"):
            title, order = title_and_order(f)
            notes.append((order, f.stem, title))
        if not notes:
            continue
        if out:
            out += ["---", ""]
        out += [f"#### {en}", ""]
        for _, slug, title in sorted(notes):
            label = title.replace("[", "\\[").replace("]", "\\]")
            out.append(f"- [{label}]({base}/{slug}/)")
        out.append("")
    return "\n".join(out)


def expected():
    """README.md as this script would write it, or None without the marker."""
    text = README.read_text(encoding="utf-8").replace("\r\n", "\n")
    head, sep, _ = text.partition(MARKER)
    return head + MARKER + "\n\n" + index() if sep else None


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    text = expected()
    if text is None:
        print(f"README.md has no marker line:\n{MARKER}")
        return 1
    README.write_text(text, encoding="utf-8", newline="\n")
    print(f"README.md: {text.count(chr(10) + '- [')} notes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
