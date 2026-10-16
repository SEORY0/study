# study

Study notes site, Jekyll on GitHub Pages (legacy branch build: `main`, root;
`github-pages` gem, Jekyll 3.10, safe mode, Ruby Sass). Served at
https://seory0.github.io/study/ (`baseurl: /study`). Layout: notes in
`studies/`, the site in `site/`, scripts in `tools/`; `_config.yml` and
`Gemfile` stay at the root. README.md is the note index (estudy style),
written by `python tools/readme.py`. site/README.md (Korean) is the manual:
read it before adding notes or touching the map.

- Notes: `studies/<subject>/<slug>.md` (pages, not a collection; the
  subject id is the folder name), front matter exactly `title, short,
  order, summary, threads, date`; body ends with `## 이어지는 곳`. Run
  `python tools/readme.py`, then `python tools/lint.py` until it reports
  0 errors and 0 warnings (it fails on a stale README index).
- Owner's rules for copy: no em dash or en dash anywhere; Korean 해라체,
  concise study-note voice; terms as 한국어(English) at first mention.
- ```` ```ascii ```` and ```` ```eq ```` blocks are hand-drawn on a character
  grid: only the glyphs listed in site/README.md, Hangul only at the end of an
  ascii line, columns verified programmatically.
- Never write `{{`, `{%` or `$$` in notes. Convolution in prose is `∗`.
- Design follows seory0.github.io: six colour tokens, one rule weight, no
  radius, shadow or motion, hover is full inversion. Check every change in
  light and dark and at 320, 375, 800 and 1440px.
- Sass: GitHub Pages compiles with Ruby Sass; use `clamp()`, never `min()`
  or `max()` with `calc()`, and interpolate slashes (`#{"1 / -1"}`).
- Liquid must run on Jekyll 3.10: no `find`/`find_exp`, and `where_exp` takes
  one comparison; `push` and `concat` are fine.
- The front page is the ring (`site/assets/js/study-ring.js`, data from
  `site/graph.json`): after adding notes, open `/study/?check=1` and confirm
  `data-collisions` on <html> lists no overlaps. Links between notes come
  from `/study/<slug>/` paths in note text; threads are unordered sets.
