// Probability that a random 9-card deal from a 52-card deck can make each 4-digit target (1000-9999).
// Reads data/misses.b64.txt (no re-solving) and weights each hand by how many deals produce it:
//   deals(hand) = product over ranks of C(4, copies of that rank); all deals = C(52, 9).
// Writes data/probability.csv: target, hands that make it (of 270,270), probability.
// Usage: node probability.js
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const E = require('./engine.js');

const LO = 1000, HI = 9999;
const C4 = [1, 4, 6, 4, 1];
let ALL = 1;
for (let i = 0; i < 9; i++) ALL = ALL * (52 - i) / (i + 1); // C(52, 9) = 3,679,075,400

const bytes = zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(__dirname, 'data/misses.b64.txt'), 'utf8'), 'base64'));
let ptr = 0;
const varint = () => { let n = 0, s = 0, b; do { b = bytes[ptr++]; n += (b & 127) * 2 ** s; s += 7; } while (b & 128); return n; };

const missHands = new Float64Array(E.TARGET + 1), missDeals = new Float64Array(E.TARGET + 1);
let hands = 0, deals = 0, fullHands = 0, fullDeals = 0;
for (const hand of E.allHands()) {
  const counts = new Array(E.RANKS).fill(0);
  for (const c of hand) counts[c - 1]++;
  const w = counts.reduce((p, k) => p * C4[k], 1);
  const k = varint();
  let prev = 0, missesRange = false;
  for (let i = 0; i < k; i++) {
    const s = prev + varint(), len = varint();
    for (let t = s; t < s + len; t++) { missHands[t]++; missDeals[t] += w; }
    if (s <= HI && s + len - 1 >= LO) missesRange = true;
    prev = s + len;
  }
  hands++; deals += w;
  if (!missesRange) { fullHands++; fullDeals += w; }
}
if (ptr !== bytes.length || deals !== ALL) throw new Error(`data mismatch: read ${ptr}/${bytes.length} bytes, ${deals}/${ALL} deals`);

const rows = ['target,hands,probability'];
let hard = LO, sum = 0;
for (let t = LO; t <= HI; t++) {
  const p = 1 - missDeals[t] / ALL;
  rows.push(`${t},${hands - missHands[t]},${p.toFixed(8)}`);
  if (missDeals[t] > missDeals[hard]) hard = t;
  sum += p;
}
fs.writeFileSync(path.join(__dirname, 'data/probability.csv'), rows.join('\n') + '\n');

const pct = x => (x * 100).toFixed(4) + '%';
console.log(`Wrote data/probability.csv (${HI - LO + 1} targets, ${fmt(hands)} hands, ${fmt(ALL)} deals)`);
console.log(`Average chance a random deal makes a given 4-digit target: ${pct(sum / (HI - LO + 1))}`);
console.log(`Hardest 4-digit target: ${hard}, made by ${pct(1 - missDeals[hard] / ALL)} of deals`);
console.log(`Chance a random deal makes every 4-digit target: ${pct(fullDeals / ALL)} (${fmt(fullHands)} of ${fmt(hands)} hands)`);
function fmt(n) { return n.toLocaleString('en-US'); }
