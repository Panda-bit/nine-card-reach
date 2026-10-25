// Probability that a random deal from a 52-card deck can make each 4-digit target (1000-9999).
// Reads the saved misses (no re-solving) and weights each hand by how many deals produce it:
//   deals(hand) = product over ranks of C(4, copies of that rank); all deals = C(52, cards).
// Writes data/probability.csv (data/probability-<cards>.csv when not 9 cards): target, hands that make it, probability.
// Prints the same stats for all 4-digit targets, the lower half (1000-4999) and the upper half (5000-9999).
// Usage: node probability.js [cards]   (needs data from `node precompute.js <workers> <cards>`)
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const E = require('./engine.js');

const CARDS = +process.argv[2] || 9, SUFFIX = CARDS === 9 ? '' : `-${CARDS}`;
const RANGES = [['All 4-digit', 1000, 9999], ['Lower', 1000, 4999], ['Upper', 5000, 9999]];
const C4 = [1, 4, 6, 4, 1];
let ALL = 1;
for (let i = 0; i < CARDS; i++) ALL = ALL * (52 - i) / (i + 1); // C(52, cards)

const bytes = zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(__dirname, `data/misses${SUFFIX}.b64.txt`), 'utf8'), 'base64'));
let ptr = 0;
const varint = () => { let n = 0, s = 0, b; do { b = bytes[ptr++]; n += (b & 127) * 2 ** s; s += 7; } while (b & 128); return n; };

const missHands = new Float64Array(E.TARGET + 1), missDeals = new Float64Array(E.TARGET + 1);
const full = RANGES.map(() => ({ hands: 0, deals: 0 }));
let hands = 0, deals = 0;
for (const hand of E.allHands(CARDS)) {
  const counts = new Array(E.RANKS).fill(0);
  for (const c of hand) counts[c - 1]++;
  const w = counts.reduce((p, k) => p * C4[k], 1);
  const k = varint(), missesRange = RANGES.map(() => false);
  let prev = 0;
  for (let i = 0; i < k; i++) {
    const s = prev + varint(), len = varint();
    for (let t = s; t < s + len; t++) { missHands[t]++; missDeals[t] += w; }
    RANGES.forEach(([, lo, hi], j) => { if (s <= hi && s + len - 1 >= lo) missesRange[j] = true; });
    prev = s + len;
  }
  hands++; deals += w;
  missesRange.forEach((m, j) => { if (!m) { full[j].hands++; full[j].deals += w; } });
}
if (ptr !== bytes.length || deals !== ALL) throw new Error(`data mismatch: read ${ptr}/${bytes.length} bytes, ${deals}/${ALL} deals`);

const prob = t => 1 - missDeals[t] / ALL;
const rows = ['target,hands,probability'];
for (let t = 1000; t <= 9999; t++) rows.push(`${t},${hands - missHands[t]},${prob(t).toFixed(8)}`);
fs.writeFileSync(path.join(__dirname, `data/probability${SUFFIX}.csv`), rows.join('\n') + '\n');

const pct = x => (x * 100).toFixed(4) + '%', fmt = n => n.toLocaleString('en-US');
console.log(`${CARDS} cards: wrote data/probability${SUFFIX}.csv (${fmt(hands)} hands, ${fmt(ALL)} deals)`);
RANGES.forEach(([name, lo, hi], j) => {
  let hard = lo, sum = 0;
  for (let t = lo; t <= hi; t++) { sum += prob(t); if (missDeals[t] > missDeals[hard]) hard = t; }
  console.log(`\n${name} (${fmt(lo)}-${fmt(hi)})`);
  console.log(`  Average chance per target:  ${pct(sum / (hi - lo + 1))}`);
  console.log(`  Hardest target:             ${fmt(hard)} (${pct(prob(hard))} of deals)`);
  console.log(`  Chance of making every one: ${pct(full[j].deals / ALL)} of deals, ${fmt(full[j].hands)} of ${fmt(hands)} hands (${pct(full[j].hands / hands)})`);
});
