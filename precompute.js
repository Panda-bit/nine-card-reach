// Solves all 270,270 hands for targets 1..10000 across worker threads and saves:
//   data/misses.b64.txt - gzipped, base64 (artifact hosting only serves text types). Decoded, per hand (in allHands() order): varint #ranges, then per range varint gap, varint length
//                      (missed targets only; a hand that makes everything is a single 0 byte)
//   data/summary.json - misses per target, hands that make everything
// Usage: node precompute.js [workers]
const { Worker, isMainThread, parentPort } = require('worker_threads');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const E = require('./engine.js');

const CHUNK = 500;

function encodeMisses(b, out) {
  const ranges = [];
  for (let i = 1; i <= E.TARGET; i++) {
    if (E.has(b, i)) continue;
    const start = i;
    while (i + 1 <= E.TARGET && !E.has(b, i + 1)) i++;
    ranges.push([start, i - start + 1]);
  }
  const varint = n => { while (n >= 128) { out.push((n & 127) | 128); n >>>= 7; } out.push(n); };
  varint(ranges.length);
  let prev = 0;
  for (const [s, len] of ranges) { varint(s - prev); varint(len); prev = s + len; }
  return ranges;
}

if (isMainThread) {
  const nWorkers = +process.argv[2] || 6;
  const hands = [...E.allHands()];
  const total = hands.length, nChunks = Math.ceil(total / CHUNK);
  const results = new Array(nChunks), missPerTarget = new Float64Array(E.TARGET + 1);
  let next = 0, doneHands = 0, fullHands = 0, fullHands1k = 0, finished = 0;
  const t0 = Date.now();
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

  const log = () => {
    const el = (Date.now() - t0) / 1000, rate = doneHands / el;
    const eta = rate ? (total - doneHands) / rate : 0;
    console.log(`${new Date().toLocaleTimeString()}  ${doneHands}/${total} (${(doneHands / total * 100).toFixed(1)}%)  ${rate.toFixed(0)} hands/s  elapsed ${(el / 60).toFixed(1)} min  ETA ${(eta / 60).toFixed(1)} min`);
  };
  const timer = setInterval(log, 30000);

  for (let w = 0; w < nWorkers; w++) {
    const worker = new Worker(__filename);
    const feed = () => {
      if (next >= nChunks) { worker.postMessage(null); return; }
      const c = next++;
      worker.postMessage({ c, hands: hands.slice(c * CHUNK, (c + 1) * CHUNK) });
    };
    worker.on('message', m => {
      results[m.c] = Buffer.from(m.bytes);
      for (const [s, len] of m.ranges) for (let i = s; i < s + len; i++) missPerTarget[i]++;
      doneHands += m.n; fullHands += m.full; fullHands1k += m.full1k;
      feed();
    });
    worker.on('exit', () => {
      if (++finished < nWorkers) return;
      clearInterval(timer); log();
      fs.writeFileSync(path.join(__dirname, 'data/misses.b64.txt'), zlib.gzipSync(Buffer.concat(results), { level: 9 }).toString('base64'));
      fs.writeFileSync(path.join(__dirname, 'data/summary.json'), JSON.stringify({
        hands: total, target: E.TARGET, fullHands, fullHands1k, misses: Array.from(missPerTarget.slice(1)),
      }));
      console.log(`DONE in ${((Date.now() - t0) / 60000).toFixed(1)} min; ${fullHands} hands make all 1-${E.TARGET}`);
    });
    feed();
  }
} else {
  parentPort.on('message', job => {
    if (!job) return process.exit(0);
    const bytes = [], ranges = [];
    let full = 0, full1k = 0;
    for (const hand of job.hands) {
      const counts = new Array(E.RANKS).fill(0);
      for (const c of hand) counts[c - 1]++;
      const r = encodeMisses(E.reach(counts, 9, true), bytes);
      if (!r.length) full++;
      if (!r.length || r[0][0] > 1000) full1k++;
      ranges.push(...r);
    }
    parentPort.postMessage({ c: job.c, bytes: Uint8Array.from(bytes), ranges, n: job.hands.length, full, full1k });
  });
}
