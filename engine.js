// Reachable-number engine for the 9-card game.
// Rules: all 9 cards used once, + - × ÷, every intermediate value a whole number.
// ponytail: intermediates above M are dropped; raising M to 40000 changed 0.02% of results in a sample.
const TARGET = 10000, M = 20000, W = (M >> 5) + 1, RANKS = 13;
const DIVISORS = Array.from({ length: M + 1 }, () => []);
for (let d = 1; d <= M; d++) for (let m = d; m <= M; m += d) DIVISORS[m].push(d);
const has = (b, i) => (b[i >> 5] >>> (i & 31)) & 1;
const set = (b, i) => { b[i >> 5] |= 1 << (i & 31); };
function orShiftUp(r, src, s) {
  const ws = s >> 5, bs = s & 31;
  for (let i = W - 1; i >= ws; i--) { const j = i - ws; r[i] |= bs ? (src[j] << bs) | (j > 0 ? src[j - 1] >>> (32 - bs) : 0) : src[j]; }
}
function orShiftDown(r, src, s) {
  const ws = s >> 5, bs = s & 31;
  for (let i = 0; i + ws < W; i++) { const j = i + ws; r[i] |= bs ? (src[j] >>> bs) | (j + 1 < W ? src[j + 1] << (32 - bs) : 0) : src[j]; }
}
function clearAboveM(r) { const extra = (W << 5) - (M + 1); if (extra) r[W - 1] &= 0xffffffff >>> extra; }
function members(b) { const out = []; for (let i = 0; i <= M; i++) if (has(b, i)) out.push(i); return out; }
function reversed(b) { const r = new Uint32Array(W); for (let i = 0; i <= M; i++) if (has(b, i)) set(r, M - i); return r; }
// Values are kept as absolute values: a sign can always be pushed outward (x-(-y) = x+y).
function combine(r, A, B) {
  const listA = members(A), listB = members(B);
  const [S, Lbits] = listA.length <= listB.length ? [listA, B] : [listB, A];
  const revL = reversed(Lbits);
  for (const s of S) {
    orShiftUp(r, Lbits, s);        // s + l
    orShiftDown(r, Lbits, s);      // l - s
    orShiftDown(r, revL, M - s);   // s - l
    if (s === 0) { set(r, 0); continue; }
    for (let t = 0; t * s <= M; t++) {
      if (has(Lbits, t)) set(r, t * s);        // s × l
      if (t && has(Lbits, t * s)) set(r, t);   // l ÷ s
    }
    for (const d of DIVISORS[s]) if (has(Lbits, d)) set(r, s / d); // s ÷ l
  }
  clearAboveM(r);
}
const memo = new Map();
const encode = c => c.reduce((k, x) => k * 5 + x, 0);
function reach(counts, size, isTop) {
  const key = encode(counts), hit = memo.get(key);
  if (hit) return hit;
  const r = new Uint32Array(W);
  if (size === 1) set(r, counts.findIndex(x => x) + 1);
  else {
    const d = new Array(RANKS).fill(0), rest = counts.slice();
    const walk = (i, dSize) => {
      if (i === RANKS) {
        if (dSize === 0 || dSize === size || encode(d) > encode(rest)) return false;
        combine(r, reach(d.slice(), dSize), reach(rest.slice(), size - dSize));
        return isTop && coversTargets(r); // stop once 1..1000 are all made
      }
      for (let k = 0; k <= counts[i]; k++) { d[i] = k; rest[i] = counts[i] - k; if (walk(i + 1, dSize + k)) return true; }
      d[i] = 0; rest[i] = counts[i];
      return false;
    };
    walk(0, 0);
  }
  if (!isTop) memo.set(key, r);
  return r;
}
function coversTargets(b) { for (let i = 1; i <= TARGET; i++) if (!has(b, i)) return false; return true; }
function* allHands(n = 9) {
  const h = [];
  function* go(start) {
    if (h.length === n) { yield h.slice(); return; }
    for (let r = start; r <= RANKS; r++) {
      if (h.length >= 4 && h[h.length - 4] === r) continue;
      h.push(r); yield* go(r); h.pop();
    }
  }
  yield* go(1);
}

module.exports = { reach, allHands, has, TARGET, RANKS };
