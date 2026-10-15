/* assets/js/study-ring.js
   The ring: every note on one circle, grouped into subjects and areas
   (sectors), with the links between notes drawn as curves through the
   inside. Links inside a subject stay near the rim; links between the
   owner's own fields (areas with home: true) and the others cross the
   middle and are drawn darkest, so the jumps between unrelated fields are
   the first thing the eye finds. A circle has no first or last place, so
   nothing reads as a sequence.

   The page holds one container with data-ring:
     data-ring="full"  the study page: ring, thread list, note panel
     data-ring="note"  a note page: a smaller ring that starts on that note
     data-graph        url of graph.json (built by Jekyll from the notes)
     data-focus        (note pages) the slug of the note

   Everything is deterministic: the same notes always give the same picture,
   so the ring redraws itself as notes are added. URL parameters ?focus=,
   ?thread=, ?field= (a subject id) and ?area= open the ring with that
   thing picked; ?check=1 lists overlapping labels in data-collisions. */
(function () {
'use strict';

const root = document.querySelector('[data-ring]');
if (!root) return;
const MODE = root.dataset.ring === 'note' ? 'note' : 'full';
const HERE = root.dataset.focus || null;
const NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
const qs = new URLSearchParams(location.search);
const $ = sel => root.querySelector(sel);

/* ===================================================================== model
   areas > subjects > notes, undirected links, threads (named ideas).
   Every link gets a class by how far it travels in that hierarchy:
   0 same subject, 1 same area, 2 another area on the same side
   (home/away), 3 between the home fields and the others.               */
function model(d) {
  const areas = d.areas.map((a, i) => ({ kind: 'area', id: a.id, name: a.name, home: !!a.home, i, subs: [] }));
  const A = new Map(areas.map(a => [a.id, a]));
  const subs = d.subjects.map((s, i) => ({ kind: 'sub', id: s.id, name: s.name, i, area: A.get(s.area), notes: [] }));
  const S = new Map(subs.map(s => [s.id, s]));
  const notes = d.notes.filter(n => S.has(n.subject) && S.get(n.subject).area).map((n, i) => ({
    kind: 'note', slug: n.slug, title: n.title, short: n.short || n.title, summary: n.summary || '',
    url: n.url, tids: n.threads || [], i, sub: S.get(n.subject), nb: new Set(), links: [], ths: []
  }));
  const N = new Map(notes.map(n => [n.slug, n]));
  notes.forEach(n => { n.area = n.sub.area; n.sub.notes.push(n); });
  subs.forEach(s => { if (s.notes.length && s.area) s.area.subs.push(s); });
  const links = [], seen = new Set();
  for (const [x, y] of d.links) {
    const a = N.get(x), b = N.get(y);
    if (!a || !b || a === b) continue;
    const key = a.i < b.i ? a.i + '|' + b.i : b.i + '|' + a.i;
    if (seen.has(key)) continue;
    seen.add(key);
    const cls = a.sub === b.sub ? 0 : a.area === b.area ? 1 : a.area.home === b.area.home ? 2 : 3;
    const L = { a, b, cls, i: links.length };
    links.push(L); a.links.push(L); b.links.push(L); a.nb.add(b); b.nb.add(a);
  }
  const threads = d.threads.map((t, i) => ({ kind: 'thread', id: t.id, mark: t.mark, name: t.name, i,
    notes: notes.filter(n => n.tids.includes(t.id)) })).filter(t => t.notes.length);
  notes.forEach(n => { n.ths = threads.filter(t => t.notes.includes(n)); });
  const live = areas.filter(a => a.subs.length);
  return { areas: live, order: live.filter(a => a.home).concat(live.filter(a => !a.home)),
           subs: subs.filter(s => s.notes.length), notes, links, threads, N, S };
}

/* ================================================================== ordering
   Deterministic: no randomness, every tie goes to data order. Cost = sum
   over links of the chord length (1 - cos of the angle between the ends).
   Areas stay grouped as home then away; areas, subjects and notes are each
   reordered to shorten links: exhaustive for up to 6 items, adjacent swaps
   beyond that.                                                          */
const U_GAP_S = 0.7, U_GAP_A = 1.8;

function unitAngles(M) {
  const pos = new Float64Array(M.notes.length);
  let u = 0;
  for (const a of M.order) {
    a.subs.forEach((s, k) => {
      if (k) u += U_GAP_S;
      for (const n of s.notes) { pos[n.i] = u + 0.5; u += 1; }
    });
    u += U_GAP_A;
  }
  const k = TAU / u;
  for (let i = 0; i < pos.length; i++) pos[i] *= k;
  return pos;
}
function cost(M) {
  const p = unitAngles(M);
  let c = 0;
  for (const L of M.links) c += 1 - Math.cos(p[L.a.i] - p[L.b.i]);
  return c;
}
function* perms(arr) {               // Heap's algorithm, deterministic order
  const a = arr.slice(), c = new Array(a.length).fill(0);
  yield a.slice();
  let i = 1;
  while (i < a.length) {
    if (c[i] < i) {
      const j = i % 2 ? c[i] : 0;
      [a[j], a[i]] = [a[i], a[j]];
      yield a.slice();
      c[i]++; i = 1;
    } else { c[i] = 0; i++; }
  }
}
function improve(items, set, M) {     // reorder `items` in place via set(order)
  let best = items.slice(), bestC = cost(M);
  if (items.length < 2) return;
  if (items.length <= 6) {
    for (const p of perms(items)) {
      set(p); const c = cost(M);
      if (c < bestC - 1e-9) { bestC = c; best = p; }
    }
  } else {
    let cur = best.slice(), again = true, guard = 0;
    while (again && guard++ < 60) {
      again = false;
      for (let i = 0; i + 1 < cur.length; i++) {
        [cur[i], cur[i + 1]] = [cur[i + 1], cur[i]]; set(cur);
        const c = cost(M);
        if (c < bestC - 1e-9) { bestC = c; again = true; }
        else { [cur[i], cur[i + 1]] = [cur[i + 1], cur[i]]; }
      }
    }
    best = cur;
  }
  set(best);
}
function orderRing(M) {
  for (let round = 0; round < 3; round++) {
    const home = M.order.filter(a => a.home), away = M.order.filter(a => !a.home);
    // the ring has no start, so the first home area is the anchor
    improve(home.slice(1), p => { M.order = [home[0], ...p, ...away]; }, M);
    const h2 = M.order.filter(a => a.home);
    improve(away, p => { M.order = [...h2, ...p]; }, M);
    for (const a of M.order) improve(a.subs, p => { a.subs = p.slice(); }, M);
    const pos = unitAngles(M);
    for (const s of M.subs) improveNotes(s, pos);
  }
}
/* notes inside one subject: only the links touching the subject change, so
   the cost is local; exhaustive up to 6 notes, adjacent swaps beyond.   */
function improveNotes(s, pos) {
  const ns = s.notes;
  if (ns.length < 2) return;
  const slots = ns.map(n => pos[n.i]).sort((x, y) => x - y);
  const inc = [...new Set(ns.flatMap(n => n.links))];
  const place = order => order.forEach((n, j) => { pos[n.i] = slots[j]; });
  const local = order => { place(order); let c = 0; for (const L of inc) c += 1 - Math.cos(pos[L.a.i] - pos[L.b.i]); return c; };
  let best = ns.slice(), bestC = local(best);
  if (ns.length <= 6) {
    for (const p of perms(ns)) { const c = local(p); if (c < bestC - 1e-9) { bestC = c; best = p; } }
  } else {
    const cur = best.slice();
    let again = true, guard = 0;
    while (again && guard++ < 80) {
      again = false;
      for (let i = 0; i + 1 < cur.length; i++) {
        [cur[i], cur[i + 1]] = [cur[i + 1], cur[i]];
        const c = local(cur);
        if (c < bestC - 1e-9) { bestC = c; again = true; } else { [cur[i], cur[i + 1]] = [cur[i + 1], cur[i]]; }
      }
    }
    best = cur;
  }
  s.notes = best.slice();
  place(s.notes);
}

/* ================================================================ geometry
   Sizes in px: fl note labels, fs subject names, fa area names, off gap
   from the ring to a label, gb/ga gaps before subject/area names, pitch
   the least distance between two labels along the ring.               */
const PRESET = {
  wide:  { fl: 13, fs: 11, fa: 11.5, off: 11, dot: 3,   gb: 15, ga: 14, hug: 0, hugA: 0, merge: false, padS: 12, padA: 18, pitch: 15.5, endGap: 6, rmax: 300 },
  small: { fl: 11, fs: 10, fa: 10.5, off: 7,  dot: 2.4, gb: 9,  ga: 8,  hug: 1, hugA: 1, merge: true,  padS: 6,  padA: 10, pitch: 12.5, endGap: 4, rmax: 220 }
};
const K = { s: 0.72, a: 0.45, g: 0.2, beta: 0.85 };   // bundle radii (x R) and strength

function measure(M, P) {
  let svg = root.querySelector('.ring-measure');
  if (!svg) {
    svg = el('svg', { class: 'ring-measure', 'aria-hidden': 'true' });
    root.appendChild(svg);
  }
  svg.textContent = '';
  const t = el('text', {}, svg);
  const w = (str, size, ls) => {
    t.setAttribute('font-size', size);
    t.style.letterSpacing = ls ? ls + 'em' : '';
    t.textContent = str;
    return t.getComputedTextLength();
  };
  M.notes.forEach(n => { n.lw = w(n.short, P.fl); });
  M.areas.forEach(a => {
    a.nw = w(a.name, P.fa, 0.16);
    // the subject with the most notes carries the area name when names merge
    a.capital = a.subs.reduce((b, x) => x.notes.length > b.notes.length ? x : b, a.subs[0]);
  });
  M.subs.forEach(s => {
    s.cap = P.merge && s.area.capital === s;
    s.nw = w(s.name, P.fs) + (s.cap ? w(s.area.name, P.fs, 0.16) + 7 : 0);
  });
  M.threads.forEach(t2 => { t2.mw = w(t2.mark, 11); });
}

function layout(M, P, W, H, phone) {
  measure(M, P);
  const Lall = Math.max(...M.notes.map(n => n.lw));
  // radial offsets past R (all linear in R, so the fit can solve for R)
  for (const s of M.subs) {
    const Ls = Math.max(...s.notes.map(n => n.lw));
    s.L = P.hug * Ls + (1 - P.hug) * Lall;
    s.cb = P.off + s.L + P.gb;                 // inner edge of the subject name
  }
  const cbAll = Math.max(...M.subs.map(s => s.cb));
  for (const a of M.order) {
    const own = Math.max(...a.subs.map(s => s.cb));
    a.ca = P.hugA * own + (1 - P.hugA) * cbAll + P.fs + P.ga + P.fa * 0.5;   // area line
  }

  let R = Math.max(60, Math.min(W, H) / 2 - Lall - 50), phi = 0, unit = 0, total = 0, overflow = false;
  for (let iter = 0; iter < 4; iter++) {
    // 1. spans in note units; a subject or area may need more room for its name
    unit = unit || TAU / (M.notes.length + 2 * M.order.length + M.subs.length);
    let u = 0;
    for (const a of M.order) {
      let inner = 0;
      a.subs.forEach((s, k) => {
        const need = (s.nw + 2 * P.padS) / ((R + s.cb) * unit);
        s.span = Math.max(s.notes.length, need);
        inner += s.span + (k ? U_GAP_S : 0);
      });
      const needA = P.merge ? 0 : (a.nw + 2 * P.padA) / ((R + a.ca) * unit);
      a.pad = Math.max(0, needA - inner) / 2;
      a.u0 = u; u += a.pad;
      a.subs.forEach((s, k) => {
        if (k) u += U_GAP_S;
        s.u0 = u;
        const o = (s.span - s.notes.length) / 2;
        s.notes.forEach((n, j) => { n.u = u + o + j + 0.5; });
        u += s.span; s.u1 = u;
      });
      u += a.pad; a.u1 = u; u += U_GAP_A;
    }
    total = u; unit = TAU / total;
    // 2. rotation and radius: the largest R whose bounding box fits W x H.
    // Labels never sit closer than one line: below that the ring grows past
    // the box, and the view is scaled down or handed to pan and zoom.
    const fit = fitRing(M, P, unit, R, W, H);
    const Rpitch = P.pitch / unit - P.off;
    overflow = fit.R < Rpitch;
    R = Math.max(fit.R, Rpitch); phi = fit.phi;
  }
  const ang = uu => phi + uu * unit - Math.PI / 2;
  const box = bbox(M, P, unit, R, phi);
  return { R, phi, unit, ang, box, overflow, P, phone, W, H };
}

/* outer points of every label and name as (angle, c, d): the point sits at
   radius R + c along the angle, shifted d across it. */
function outline(M, P, unit, R) {
  const pts = [];
  const add = (a, c, d) => pts.push([a, c, d]);
  for (const n of M.notes) {
    const a = n.u * unit;
    add(a, P.off + n.lw, P.fl * 0.6); add(a, P.off + n.lw, -P.fl * 0.6);
  }
  for (const s of M.subs) {
    const mid = (s.u0 + s.u1) / 2 * unit, hw = (s.nw / 2 + 2) / (R + s.cb);
    for (let k = -3; k <= 3; k++) add(mid + hw * k / 3, s.cb + P.fs, 0);
  }
  if (!P.merge) for (const a of M.order) {
    // the wheel closes across the gaps, so sample half a gap either side
    const a0 = (a.u0 - U_GAP_A / 2) * unit, a1 = (a.u1 + U_GAP_A / 2) * unit, steps = Math.max(4, Math.ceil((a1 - a0) / 0.05));
    for (let k = 0; k <= steps; k++) add(a0 + (a1 - a0) * k / steps, a.ca + P.fa * 0.6, 0);
  }
  return pts;
}
/* the outline packed once: base direction plus c and d, so a rotation is
   two multiplications per point and no trigonometry. */
function pack(pts) {
  const n = pts.length, ca = new Float64Array(n), sa = new Float64Array(n), c = new Float64Array(n), d = new Float64Array(n);
  pts.forEach(([a, cc, dd], i) => { const t = a - Math.PI / 2; ca[i] = Math.cos(t); sa[i] = Math.sin(t); c[i] = cc; d[i] = dd; });
  return { n, ca, sa, c, d };
}
function extentsP(k, R, cp, sp) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < k.n; i++) {
    const co = k.ca[i] * cp - k.sa[i] * sp, si = k.sa[i] * cp + k.ca[i] * sp, r = R + k.c[i], d = k.d[i];
    const x = r * co - d * si, y = r * si + d * co;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1 };
}
function bbox(M, P, unit, R, phi) { return extentsP(pack(outline(M, P, unit, R)), R, Math.cos(phi), Math.sin(phi)); }
function fitRing(M, P, unit, Rguess, W, H) {
  const k = pack(outline(M, P, unit, Rguess));
  const away = M.order.filter(a => !a.home);
  const awayMid = away.length ? (away[0].u0 + away[away.length - 1].u1) / 2 * unit : null;
  let best = null;
  const tryPhi = phi => {
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const ok = R => { const e = extentsP(k, R, cp, sp); return e.x1 - e.x0 <= W && e.y1 - e.y0 <= H; };
    let lo = 10, hi = P.rmax;
    if (ok(hi)) lo = hi;
    else for (let j = 0; j < 20; j++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    // prefer the away fields at the bottom: a gentle 4 % tie-breaker
    let score = lo;
    if (awayMid !== null) score *= 1 - 0.04 * (1 - Math.sin(awayMid + phi - Math.PI / 2)) / 2;
    if (!best || score > best.score + 1e-9) best = { phi, R: lo, score };
  };
  for (let d = 0; d < 360; d += 3) tryPhi(d * Math.PI / 180);
  const p0 = best.phi;
  for (let d = -3; d <= 3; d += 0.25) tryPhi(p0 + d * Math.PI / 180);
  return best;
}

/* ================================================================== bundles
   Holten's hierarchical edge bundling: a link is a B-spline whose control
   points climb the hierarchy (note > subject > area > side > centre) from
   one end to the lowest common ancestor and back down to the other end,
   straightened by beta.                                                 */
function hierarchy(M, G) {
  const { R, ang } = G;
  const at = (uu, r) => { const a = ang(uu); return [r * Math.cos(a), r * Math.sin(a)]; };
  const sides = [M.order.filter(a => a.home), M.order.filter(a => !a.home)];
  const sideNode = sides.map(list => list.length ? { p: at((list[0].u0 + list[list.length - 1].u1) / 2, K.g * R) } : null);
  const centre = { p: [0, 0] };
  for (const a of M.order) {
    a.node = { p: at((a.u0 + a.u1) / 2, K.a * R) };
    a.side = sideNode[a.home ? 0 : 1];
  }
  for (const s of M.subs) s.node = { p: at((s.u0 + s.u1) / 2, K.s * R) };
  for (const n of M.notes) {
    n.a = ang(n.u);
    n.p = [R * Math.cos(n.a), R * Math.sin(n.a)];
    n.pe = [(R - G.P.endGap) * Math.cos(n.a), (R - G.P.endGap) * Math.sin(n.a)];
    n.chain = [{ p: n.pe }, n.sub.node, n.area.node, n.area.side, centre];
  }
}
function linkPath(L) {
  const ca = L.a.chain, cb = L.b.chain;
  let k = 1;
  while (k < ca.length && ca[k] !== cb[k]) k++;
  const pts = [];
  for (let i = 0; i <= k; i++) pts.push(ca[i].p);
  for (let i = k - 1; i >= 0; i--) pts.push(cb[i].p);
  // straighten, as d3.curveBundle does
  const n = pts.length - 1, [x0, y0] = pts[0], dx = pts[n][0] - x0, dy = pts[n][1] - y0;
  const s = pts.map(([x, y], i) => [K.beta * x + (1 - K.beta) * (x0 + i * dx / n), K.beta * y + (1 - K.beta) * (y0 + i * dy / n)]);
  return basis(s);
}
function basis(pts) {              // the maths of d3.curveBasis
  let d = '', p = 0, x0, y0, x1, y1;
  const f = v => Math.round(v * 100) / 100;
  const B = (x, y) => { d += `C${f((2 * x0 + x1) / 3)},${f((2 * y0 + y1) / 3)} ${f((x0 + 2 * x1) / 3)},${f((y0 + 2 * y1) / 3)} ${f((x0 + 4 * x1 + x) / 6)},${f((y0 + 4 * y1 + y) / 6)}`; };
  for (const [x, y] of pts) {
    switch (p) {
      case 0: p = 1; d += `M${f(x)},${f(y)}`; break;
      case 1: p = 2; break;
      case 2: p = 3; d += `L${f((5 * x0 + x1) / 6)},${f((5 * y0 + y1) / 6)}`; // falls through
      default: B(x, y);
    }
    x0 = x1; x1 = x; y0 = y1; y1 = y;
  }
  if (p === 3) B(x1, y1);
  if (p >= 2) d += `L${f(x1)},${f(y1)}`;
  return d;
}

/* thread marks sit at the pull of their notes (near the rim if they are
   close together, near the centre if spread out), then push each other
   apart. Deterministic iterations.                                      */
function hubs(M, G) {
  const { R } = G;
  for (const t of M.threads) {
    let x = 0, y = 0;
    for (const n of t.notes) { x += Math.cos(n.a); y += Math.sin(n.a); }
    x /= t.notes.length; y /= t.notes.length;
    const len = Math.hypot(x, y), a = len > 1e-6 ? Math.atan2(y, x) : -Math.PI / 2 + t.i;
    const r = R * Math.min(0.66, 0.24 + 0.5 * len);
    t.h = [r * Math.cos(a), r * Math.sin(a)];
  }
  const T = M.threads;
  for (let it = 0; it < 120; it++) {
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
      const A = T[i].h, B = T[j].h;
      const need = (T[i].mw + T[j].mw) / 2 + 14, needY = 26;
      const dx = B[0] - A[0], dy = B[1] - A[1];
      if (Math.abs(dx) < need && Math.abs(dy) < needY) {
        const px = need - Math.abs(dx), py = needY - Math.abs(dy);
        if (py * 1.6 < px) { const s = (dy >= 0 ? 1 : -1) * py / 2; A[1] -= s; B[1] += s; }
        else { const s = (dx >= 0 ? 1 : -1) * px / 2; A[0] -= s; B[0] += s; }
      }
    }
    for (const t of T) {           // stay well inside the ring
      const r = Math.hypot(t.h[0], t.h[1]), lim = R * 0.72 - t.mw / 2;
      if (r > lim) { t.h[0] *= lim / r; t.h[1] *= lim / r; }
    }
  }
}

/* ==================================================================== draw */
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const f2 = v => Math.round(v * 100) / 100;
function arc(r, a0, a1, reverse) {
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const P0 = [r * Math.cos(a0), r * Math.sin(a0)], P1 = [r * Math.cos(a1), r * Math.sin(a1)];
  return reverse
    ? `M${f2(P1[0])},${f2(P1[1])}A${f2(r)},${f2(r)} 0 ${large} 0 ${f2(P0[0])},${f2(P0[1])}`
    : `M${f2(P0[0])},${f2(P0[1])}A${f2(r)},${f2(r)} 0 ${large} 1 ${f2(P1[0])},${f2(P1[1])}`;
}
const deg = a => a * 180 / Math.PI;
const radial = (aa, r0, r1) => `M${f2(r0 * Math.cos(aa))},${f2(r0 * Math.sin(aa))}L${f2(r1 * Math.cos(aa))},${f2(r1 * Math.sin(aa))}`;

function draw(M, G) {
  const svg = $('.ring-svg');
  const { R, P, ang, box } = G;
  const pad = 2;
  const vb = [box.x0 - pad, box.y0 - pad, box.x1 - box.x0 + 2 * pad, box.y1 - box.y0 + 2 * pad];
  svg.setAttribute('viewBox', vb.map(f2).join(' '));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  // a ring only slightly too big is scaled to fit; pan and zoom start when
  // that would shrink the labels below three quarters of their size
  const fitScale = Math.min(G.W / vb[2], (G.phone ? G.W * 1.3 : G.H) / vb[3]);
  const zoom = G.overflow && fitScale < 0.75;
  Z.on = zoom; Z.vb0 = vb.slice(); Z.vb = vb.slice();
  const mapEl = $('.ringmap');
  mapEl.classList.toggle('zooms', Z.on);
  mapEl.classList.toggle('zooms-touch', Z.on && G.phone);
  if (zoom) {
    svg.style.aspectRatio = ''; svg.style.margin = '0';
    svg.style.width = G.W + 'px'; svg.style.height = (G.phone ? Math.round(Math.min(G.W * 1.15, window.innerHeight * 0.72)) : G.H) + 'px';
  } else if (G.phone || G.overflow) {
    svg.style.aspectRatio = vb[2] + ' / ' + vb[3]; svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.margin = '0';
  } else {
    svg.style.aspectRatio = ''; svg.style.width = f2(vb[2]) + 'px'; svg.style.height = f2(vb[3]) + 'px'; svg.style.margin = '0 auto';
  }
  svg.textContent = '';
  const defs = el('defs', {}, svg);

  /* links, quiet ones first so the long jumps sit on top */
  const gL = el('g', { 'aria-hidden': 'true' }, svg);
  M.links.slice().sort((x, y) => x.cls - y.cls || x.i - y.i).forEach(L => {
    L.el = el('path', { class: 'lnk c' + L.cls, d: linkPath(L) }, gL);
  });

  /* thread spokes (dotted, shown when a thread or its note is picked) */
  const gS = el('g', { 'aria-hidden': 'true' }, svg);
  for (const t of M.threads) {
    let d = '';
    for (const n of t.notes) d += `M${f2(t.h[0])},${f2(t.h[1])}L${f2(n.pe[0])},${f2(n.pe[1])}`;
    t.spk = el('path', { class: 'spk', d }, gS);
  }

  /* the ring: one arc per subject */
  const gR = el('g', { 'aria-hidden': 'true' }, svg);
  for (const s of M.subs) {
    const first = s.area.subs[0] === s, last = s.area.subs[s.area.subs.length - 1] === s;
    const a0 = ang((first ? s.area.u0 + 0.35 : s.u0) + 0.12), a1 = ang((last ? s.area.u1 - 0.35 : s.u1) - 0.12);
    s.arc = el('path', { class: 'ring-arc', d: arc(R, a0, a1) }, gR);
  }

  /* subject names, curved, just past their longest label */
  const gB = el('g', {}, svg);
  M.subs.forEach((s, i) => {
    const mid = ang((s.u0 + s.u1) / 2), bottom = Math.sin(mid) > 0.05;
    const r = R + s.cb + (bottom ? P.fs * 0.78 : P.fs * 0.12);
    const hw = Math.min(Math.PI * 0.9, (s.nw / 2 + 30) / r);
    const id = MODE + '-sp' + i;
    el('path', { id, d: arc(r, mid - hw, mid + hw, bottom), fill: 'none' }, defs);
    const t = el('text', { class: 'sub', 'font-size': P.fs, tabindex: 0, role: 'button', 'aria-label': s.name + ' 과목 보기' }, gB);
    const tp = el('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' }, t);
    if (s.cap) {
      const at = el('tspan', { class: 'area', 'letter-spacing': '.16em' }, tp);
      at.textContent = s.area.name;
      const nt = el('tspan', { dx: 7 }, tp);
      nt.textContent = s.name;
      s.area.el = at; s.area.lines = [];
      at.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); const tg = { kind: 'area', ref: s.area }; ui.pin = same(ui.pin, tg) ? null : tg; apply(); });
    } else tp.textContent = s.name;
    s.el = t;
    bind(t, { kind: 'sub', ref: s });
  });

  /* areas: hairline sector dividers, and a line around the outside broken
     for the area's name */
  if (!P.merge) {
    let d = '';
    M.order.forEach(a => { d += radial(ang(a.u1 + U_GAP_A / 2), R + 4, R + a.ca); });
    el('path', { class: 'divider', d }, gB);
    let d2 = '';
    for (const a of M.order) a.subs.forEach((s, k) => {
      if (k) d2 += radial(ang(s.u0 - U_GAP_S / 2), R + 4, R + a.ca);
    });
    if (d2) el('path', { class: 'divider sd', d: d2 }, gB);
    M.order.forEach((a, i) => {
      const r = R + a.ca, mid = ang((a.u0 + a.u1) / 2), bottom = Math.sin(mid) > 0.05;
      const a0 = ang(a.u0 - U_GAP_A / 2), a1 = ang(a.u1 + U_GAP_A / 2);
      const tw = (a.nw / 2 + 7) / r;
      const g = el('g', {}, gB);
      a.lines = [];
      if (mid - tw - a0 > 0.004) a.lines.push(el('path', { class: 'area-line', d: arc(r, a0, mid - tw) }, g));
      if (a1 - (mid + tw) > 0.004) a.lines.push(el('path', { class: 'area-line', d: arc(r, mid + tw, a1) }, g));
      const rt = r + (bottom ? P.fa * 0.36 : -P.fa * 0.36);
      const hw = Math.min(Math.PI * 0.9, (a.nw / 2 + 40) / rt);
      const id = MODE + '-ap' + i;
      el('path', { id, d: arc(rt, mid - hw, mid + hw, bottom), fill: 'none' }, defs);
      const t = el('text', { class: 'area', 'font-size': P.fa, tabindex: 0, role: 'button', 'aria-label': a.name + ' 분야 보기' }, g);
      const tp = el('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' }, t);
      tp.textContent = a.name;
      a.el = t;
      bind(t, { kind: 'area', ref: a });
    });
  }

  /* notes: a dot on the ring and the label radiating out, turned over on
     the left half so it never reads upside down */
  const gN = el('g', {}, svg);
  for (const n of M.notes) {
    const left = Math.cos(n.a) < -1e-6;
    const rot = deg(n.a) + (left ? 180 : 0), sg = left ? -1 : 1;
    const a = el('a', { class: 'note' + (n.slug === HERE ? ' here' : ''), href: n.url, 'data-slug': n.slug,
      'aria-label': `${n.title}. ${n.sub.name}. ${n.summary}` }, gN);
    if (n.slug === HERE) a.setAttribute('aria-current', 'page');
    const g = el('g', { transform: `rotate(${f2(rot)})` }, a);
    const x0 = sg * (R - 8), x1 = sg * (R + P.off + n.lw + 5), h = P.fl * 1.5;
    el('rect', { class: 'hit', x: f2(Math.min(x0, x1)), y: f2(-h / 2), width: f2(Math.abs(x1 - x0)), height: f2(h) }, g);
    const i0 = sg * (R + P.off - 4), i1 = sg * (R + P.off + n.lw + 4), ih = P.fl + 5;
    el('rect', { class: 'inv', x: f2(Math.min(i0, i1)), y: f2(-ih / 2), width: f2(Math.abs(i1 - i0)), height: f2(ih) }, g);
    el('circle', { class: 'dot', cx: f2(sg * R), cy: 0, r: P.dot }, g);
    const t = el('text', { class: 'lab', x: f2(sg * (R + P.off)), y: 0, dy: '.36em', 'font-size': P.fl,
      'text-anchor': left ? 'end' : 'start' }, g);
    t.textContent = n.short;
    n.g = a;
    bind(a, { kind: 'note', ref: n });
  }

  /* thread marks */
  const gH = el('g', {}, svg);
  for (const t of M.threads) {
    const g = el('g', { class: 'hub', 'aria-hidden': 'true' }, gH);
    el('rect', { x: f2(t.h[0] - t.mw / 2 - 4), y: f2(t.h[1] - 9), width: f2(t.mw + 8), height: 18, fill: 'transparent' }, g);
    const tx = el('text', { x: f2(t.h[0]), y: f2(t.h[1]), dy: '.35em', 'text-anchor': 'middle', 'font-size': 11 }, g);
    tx.textContent = t.mark;
    t.hub = g;
    bind(g, { kind: 'thread', ref: t });
  }
}

/* ============================================================ pan and zoom
   Only when the ring has outgrown the screen (labels never shrink below one
   line apart, so a few hundred notes make the ring larger than the view):
   wheel or pinch to zoom, drag to pan, buttons to step and reset.        */
const Z = { on: false, vb0: null, vb: null, ptrs: new Map(), start: null, moved: false };
function setView(vb) { Z.vb = vb; $('.ring-svg').setAttribute('viewBox', vb.map(f2).join(' ')); }
function toSvg(cx, cy) { const m = $('.ring-svg').getScreenCTM().inverse(); return [m.a * cx + m.c * cy + m.e, m.b * cx + m.d * cy + m.f]; }
function zoomAt(px, py, f, from) {
  const [x, y, w, h] = from || Z.vb;
  const nw = Math.min(Z.vb0[2], Math.max(Z.vb0[2] / 16, w / f)), k = nw / w;
  setView([px - (px - x) * k, py - (py - y) * k, w * k, h * k]);
}
function zoomSetup() {
  const svg = $('.ring-svg');
  svg.addEventListener('wheel', e => {
    if (!Z.on) return;
    e.preventDefault();
    const [px, py] = toSvg(e.clientX, e.clientY);
    zoomAt(px, py, Math.exp(-e.deltaY * 0.0016));
  }, { passive: false });
  const begin = () => { Z.start = { vb: Z.vb.slice(), pts: new Map(Z.ptrs), k: 1 / svg.getScreenCTM().a }; };
  svg.addEventListener('pointerdown', e => { if (!Z.on) return; Z.ptrs.set(e.pointerId, [e.clientX, e.clientY]); Z.moved = false; begin(); });
  svg.addEventListener('pointermove', e => {
    if (!Z.on || !Z.ptrs.has(e.pointerId)) return;
    Z.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const st = Z.start;
    if (Z.ptrs.size === 1) {
      const [sx, sy] = st.pts.get(e.pointerId), dx = e.clientX - sx, dy = e.clientY - sy;
      if (!Z.moved && Math.hypot(dx, dy) < 5) return;
      if (!Z.moved) { Z.moved = true; try { svg.setPointerCapture(e.pointerId); } catch (_) {} }
      setView([st.vb[0] - dx * st.k, st.vb[1] - dy * st.k, st.vb[2], st.vb[3]]);
    } else if (Z.ptrs.size === 2) {
      const [a, b] = [...Z.ptrs.values()], [a0, b0] = [...st.pts.values()];
      if (!a0 || !b0) return;
      Z.moved = true;
      const f = Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(1, Math.hypot(a0[0] - b0[0], a0[1] - b0[1]));
      const cx = (a0[0] + b0[0]) / 2, cy = (a0[1] + b0[1]) / 2;
      const r = svg.getBoundingClientRect();
      const px = st.vb[0] + (cx - r.left) * st.k - (r.width * st.k - st.vb[2]) / 2;
      const py = st.vb[1] + (cy - r.top) * st.k - (r.height * st.k - st.vb[3]) / 2;
      zoomAt(px, py, f, st.vb);
    }
  });
  const end = e => { if (!Z.ptrs.delete(e.pointerId)) return; begin(); };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('click', e => { if (Z.moved) { e.stopPropagation(); e.preventDefault(); Z.moved = false; } }, true);
  const ctl = document.createElement('div');
  ctl.className = 'zoom';
  ctl.innerHTML = '<button type="button" data-z="in" aria-label="확대">+</button><button type="button" data-z="out" aria-label="축소">−</button><button type="button" data-z="fit" aria-label="전체 보기">전체</button>';
  ctl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !Z.on) return;
    const [x, y, w, h] = Z.vb, cx = x + w / 2, cy = y + h / 2;
    if (b.dataset.z === 'in') zoomAt(cx, cy, 1.6);
    else if (b.dataset.z === 'out') zoomAt(cx, cy, 1 / 1.6);
    else setView(Z.vb0.slice());
  });
  $('.ringmap').appendChild(ctl);
}

/* ============================================================= interaction
   Pointing at (or focusing) a note, subject, area or thread lights it and
   what it touches; clicking pins it. Touch: the first tap on a note shows
   it, the second opens it. On a note page the ring rests on that note.  */
const ui = { pin: null, hover: null, touch: false };
let M, G, REST = null;

function same(x, y) { return x && y && x.kind === y.kind && x.ref === y.ref; }
function bind(node, target) {
  node.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') { ui.hover = target; apply(); } });
  node.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') { ui.hover = null; apply(); } });
  node.addEventListener('pointerdown', e => { ui.touch = e.pointerType === 'touch'; });
  node.addEventListener('focus', () => { ui.hover = target; apply(); });
  node.addEventListener('blur', () => { ui.hover = null; apply(); });
  node.addEventListener('click', e => {
    if (target.kind === 'note') {
      if (ui.touch && !same(ui.pin, target) && !(target.ref.slug === HERE)) { e.preventDefault(); ui.pin = target; ui.hover = null; apply(); }
      return;
    }
    e.preventDefault();
    ui.pin = same(ui.pin, target) ? null : target;
    if (ui.touch) ui.hover = null;
    apply();
  });
  node.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && target.kind !== 'note') { e.preventDefault(); node.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    if (target.kind === 'note' && /^Arrow/.test(e.key)) {
      e.preventDefault();
      const seq = M.notes.slice().sort((a, b) => a.u - b.u), i = seq.indexOf(target.ref);
      const step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      seq[(i + step + seq.length) % seq.length].g.focus();
    }
  });
}

function apply() {
  const cur = ui.hover || ui.pin || REST;
  const svg = $('.ring-svg');
  svg.querySelectorAll('.on,.nb,.hot').forEach(e => e.classList.remove('on', 'nb', 'hot'));
  root.querySelectorAll('.ring-threads .on').forEach(e => e.classList.remove('on'));
  svg.classList.toggle('dim', !!cur);
  info(ui.hover || ui.pin);
  if (!cur) return;
  const lit = new Set(), nb = new Set(), links = new Set(), ths = new Set(), subs = new Set(), areas = new Set();
  const touch = set => { for (const n of set) for (const L of n.links) { links.add(L); nb.add(L.a); nb.add(L.b); } };
  if (cur.kind === 'note') {
    const n = cur.ref; lit.add(n); touch(lit);
    for (const t of n.ths) { ths.add(t); t.notes.forEach(m => nb.add(m)); }
    subs.add(n.sub);
    n.g.classList.add('hot');
    areas.add(n.area);
  } else if (cur.kind === 'thread') {
    const t = cur.ref; ths.add(t); t.notes.forEach(m => lit.add(m));
    for (const L of M.links) if (lit.has(L.a) && lit.has(L.b)) links.add(L);
  } else if (cur.kind === 'sub') {
    cur.ref.notes.forEach(m => lit.add(m)); touch(lit); subs.add(cur.ref); areas.add(cur.ref.area);
  } else if (cur.kind === 'area') {
    cur.ref.subs.forEach(s => { s.notes.forEach(m => lit.add(m)); subs.add(s); }); touch(lit); areas.add(cur.ref);
  }
  lit.forEach(n => n.g.classList.add('on'));
  nb.forEach(n => { if (!lit.has(n)) n.g.classList.add('nb'); });
  links.forEach(L => L.el.classList.add('on'));
  ths.forEach(t => { t.hub.classList.add('on'); t.spk.classList.add('on'); if (t.btn) t.btn.classList.add('on'); });
  subs.forEach(s => { s.el.classList.add('on'); s.arc.classList.add('on'); });
  areas.forEach(a => { if (a.el) a.el.classList.add('on'); (a.lines || []).forEach(l => l.classList.add('on')); });
}

/* the note panel (study page only) */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function info(cur) {
  const box = $('.ring-info');
  if (!box) return;
  box.classList.toggle('open', !!cur);
  const close = '<button class="x" type="button" aria-label="닫기">×</button>';
  if (!cur) {
    const far = M.links.filter(L => L.cls >= 2).length, out = M.links.filter(L => L.cls === 3).length;
    const awayNames = M.order.filter(a => !a.home).map(a => a.name).join('·');
    box.innerHTML = `<p class="idle">연결 ${M.links.length}개 중 ${far}개가 분야를 넘고, ${out}개는 전공 밖(${esc(awayNames)})으로 건너간다. 점이나 이름을 가리키면 이어진 것만 남는다.</p>`;
    return;
  }
  const r = cur.ref;
  if (cur.kind === 'note') {
    const far = r.links.filter(L => L.cls >= 2).length;
    const near = r.links.map(L => (L.a === r ? L.b : L.a)).sort((a, b) => a.u - b.u);
    box.innerHTML = close + `<p class="crumb">${esc(r.area.name)} › ${esc(r.sub.name)}</p><h2>${esc(r.title)}</h2>` +
      `<p class="sum">${esc(r.summary)}</p>` +
      (r.ths.length ? `<p class="tags">${r.ths.map(t => `<span class="box">${esc(t.mark)} ${esc(t.name)}</span>`).join('')}</p>` : '') +
      `<p class="meta">연결 <b>${r.links.length}</b>` + (far ? ` · 다른 분야로 <b>${far}</b>` : '') +
      `<br>${near.map(m => esc(m.short)).join(', ')}</p>` +
      `<a class="go" href="${esc(r.url)}">노트 열기 →</a>`;
  } else if (cur.kind === 'thread') {
    const subsOf = [...new Set(r.notes.map(n => n.sub.name))];
    box.innerHTML = close + `<p class="crumb">실 · 노트 ${r.notes.length}개, 과목 ${subsOf.length}개</p><h2>${esc(r.mark)} ${esc(r.name)}</h2>` +
      `<p class="meta">${r.notes.slice().sort((a, b) => a.u - b.u).map(n => `<b>${esc(n.short)}</b> <span>${esc(n.sub.name)}</span>`).join('<br>')}</p>`;
  } else {
    const notes = cur.kind === 'sub' ? r.notes : r.subs.flatMap(s => s.notes);
    const set = new Set(notes), outLinks = new Set();
    notes.forEach(n => n.links.forEach(L => { if (!set.has(L.a) || !set.has(L.b)) outLinks.add(L); }));
    box.innerHTML = close + `<p class="crumb">${cur.kind === 'sub' ? esc(r.area.name) + ' › 과목' : '분야' + (r.home ? '' : ' · 전공 밖')}</p><h2>${esc(r.name)}</h2>` +
      `<p class="meta">노트 <b>${notes.length}</b> · 밖으로 이어진 연결 <b>${outLinks.size}</b><br>${notes.map(n => esc(n.short)).join(', ')}</p>`;
  }
  const x = box.querySelector('.x');
  if (x) x.addEventListener('click', () => { ui.pin = null; ui.hover = null; apply(); });
}

/* the thread list (study page only) */
function lists() {
  const ul = $('.ring-threads');
  if (ul) {
    ul.textContent = '';
    for (const t of M.threads) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="mk">${esc(t.mark)}</span><span>${esc(t.name)}</span><span class="n">${t.notes.length}</span>`;
      b.setAttribute('aria-label', `${t.mark} ${t.name}, 노트 ${t.notes.length}개`);
      li.appendChild(b); ul.appendChild(li);
      t.btn = b;
      const tg = { kind: 'thread', ref: t };
      b.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') { ui.hover = tg; apply(); } });
      b.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') { ui.hover = null; apply(); } });
      b.addEventListener('focus', () => { ui.hover = tg; apply(); });
      b.addEventListener('blur', () => { ui.hover = null; apply(); });
      b.addEventListener('click', () => { ui.pin = same(ui.pin, tg) ? null : tg; apply(); });
    }
  }
  root.querySelectorAll('[data-count]').forEach(e => {
    e.textContent = `${M.notes.length} notes · ${M.links.length} links · ${M.threads.length} threads`;
  });
}

/* ?check=1: test every pair of visible text boxes for overlap and write
   the offenders to data-collisions on <html> (for checking new notes). */
function checkCollisions() {
  const boxes = [];
  const poly = (m, b) => { const pt = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; return [pt(b.x, b.y), pt(b.x + b.width, b.y), pt(b.x + b.width, b.y + b.height), pt(b.x, b.y + b.height)]; };
  let id = 0;
  root.querySelectorAll('.ring-svg .lab, .ring-svg .sub, .ring-svg text.area').forEach(t => {
    const m = t.getScreenCTM(), who = id++;
    if (t.classList.contains('lab')) { const b = t.getBBox(); if (b.width) boxes.push({ who, name: t.textContent, poly: poly(m, b) }); return; }
    for (let i = 0; i < t.getNumberOfChars(); i++) {
      const e = t.getExtentOfChar(i);
      if (!e.width || /\s/.test(t.textContent[i] || '')) continue;
      const sx = e.width * 0.18, sy = e.height * 0.18;
      boxes.push({ who, name: t.textContent, poly: poly(m, { x: e.x + sx, y: e.y + sy, width: e.width - 2 * sx, height: e.height - 2 * sy }) });
    }
  });
  const axes = p => p.map((q, i) => { const r = p[(i + 1) % p.length]; return [q[1] - r[1], r[0] - q[0]]; });
  const proj = (p, a) => { let lo = Infinity, hi = -Infinity; for (const q of p) { const v = q[0] * a[0] + q[1] * a[1]; lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
  const hit = (A, B) => axes(A).concat(axes(B)).every(a => { const [a0, a1] = proj(A, a), [b0, b1] = proj(B, a); return a1 > b0 + 0.5 && b1 > a0 + 0.5; });
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (boxes[i].who === boxes[j].who || !hit(boxes[i].poly, boxes[j].poly)) continue;
    const k = boxes[i].name + ' x ' + boxes[j].name;
    if (!out.includes(k)) out.push(k);
  }
  document.documentElement.dataset.collisions = JSON.stringify({ texts: boxes.length, overlaps: out });
}

/* ------------------------------------------------------------------ boot */
function sizeAndDraw() {
  const phone = window.innerWidth < 760;
  const map = $('.ringmap');
  const W = Math.max(280, map.clientWidth);
  let P = phone ? PRESET.small : PRESET.wide, H;
  if (MODE === 'note') {
    H = Math.round(phone ? W * 1.2 : Math.min(W, 640));
  } else {
    const top = map.getBoundingClientRect().top + window.scrollY;
    H = phone ? Math.round(W * 1.35) : Math.max(560, window.innerHeight - top - 40);
  }
  G = layout(M, P, W, H, phone);
  hierarchy(M, G);
  hubs(M, G);
  draw(M, G);
  apply();
}

function start(data) {
  M = model(data);
  if (!M.notes.length) return;
  orderRing(M);
  lists();
  zoomSetup();
  $('.ring-svg').addEventListener('click', e => {
    if (!e.target.closest('.note,.sub,.area,.hub')) { ui.pin = null; ui.hover = null; apply(); }
  });
  if (HERE && M.N.has(HERE)) REST = { kind: 'note', ref: M.N.get(HERE) };
  root.classList.add('ready');
  sizeAndDraw();
  const f = qs.get('focus'), th = qs.get('thread'), fi = qs.get('field'), ar = qs.get('area');
  if (f && M.N.has(f)) ui.pin = { kind: 'note', ref: M.N.get(f) };
  else if (th) { const t = M.threads.find(x => x.id === th); if (t) ui.pin = { kind: 'thread', ref: t }; }
  else if (fi && M.S.has(fi)) ui.pin = { kind: 'sub', ref: M.S.get(fi) };
  else if (ar) { const a = M.areas.find(x => x.id === ar || x.name === ar); if (a) ui.pin = { kind: 'area', ref: a }; }
  apply();
  if (qs.get('check')) checkCollisions();
  let rt = 0, lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (window.innerWidth !== lastW || window.innerWidth >= 760) { lastW = window.innerWidth; sizeAndDraw(); } }, 120);
  });
  if (document.fonts) document.fonts.addEventListener('loadingdone', () => sizeAndDraw());
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && M) { ui.pin = null; ui.hover = null; apply(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
});

const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
Promise.all([
  fetch(root.dataset.graph).then(r => r.json()),
  fonts,
  document.fonts ? document.fonts.load('13px "Portfolio Sans"', '가') : null
].filter(Boolean)).then(([data]) => start(data)).catch(() => {});
})();
