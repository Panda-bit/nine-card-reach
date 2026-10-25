# Nine Card Reach

You're dealt 9 playing cards (A=1, 2–10, J=11, Q=12, K=13) and given a target like 223. Using all 9 cards once with + − × ÷, can you make it?

This project solves that for **every possible 9-card hand** and **every target from 1 to 10,000**, then shows the result as a 3D grid: one bar per target, its height counting how many hands can make it. You can replay all 270,270 hands in order and watch the grid fill in.

## Results

- **270,270** distinct hands. Order doesn't matter, so the 9! orderings of a hand count as one hand. The deck has four of each rank.
- **241,441 hands (89.3%)** can make every number from 1 to 10,000.
- **270,011 hands (99.9%)** can make every number from 1 to 1,000.
- Every hand can make every number from 1 to 130.
- The hardest target is **9,643**, which 11,242 hands can't make.
- The weakest hand is `A A A A 2 2 2 2 3`, which misses 9,837 targets.
- All 715 hands with nine different ranks make every target.

## Rules used

- All 9 cards must be used, each once.
- Operations: `+ − × ÷`, with any grouping (any parenthesization).
- Every intermediate result must be a whole number, so `7 ÷ 2` is not allowed even as a step.
- Intermediate values are capped at 20,000. Raising the cap to 40,000 changed 0.02% of results in a 40-hand sample, at twice the cost.

## How it works

`engine.js` computes the set of reachable values for a multiset of cards by splitting it every way into two smaller multisets and combining their sets. Sets are bitsets over `0..20000`. Values are tracked as absolute values, since a minus sign can always be moved outward (`a − (−b) = a + b`). Results for groups of up to 8 cards are cached, and a hand stops early once it covers every target.

`precompute.js` runs every hand across worker threads and writes:

| File | Contents |
|---|---|
| `data/summary.json` | Per-target miss counts, plus how many hands make everything |
| `data/misses.b64.txt` | The targets each hand misses, in hand order (gzipped, then base64) |

The data is gzipped and base64-encoded because some static hosts only serve text files. Decoded, each hand is a varint count of missed ranges, followed by a `(gap, length)` varint pair for each range. A hand that makes everything is a single `0` byte.

`probability.js` reads the saved data and writes `data/probability.csv`: for every 4-digit target (1000–9999), how many hands make it and the probability that a random 9-card deal from a full deck can make it. Hands are weighted by how many deals produce them (the product of C(4, copies) over ranks, out of C(52, 9) = 3,679,075,400 deals), so a hand like `A A A A 2 2 2 2 3` counts far less than one with nine different ranks. Run it with `node probability.js` (about a second). It also prints the lower (1000–4999) and upper (5000–9999) halves separately.

Both scripts take a hand size. `node precompute.js 4 8` solves all 120,055 eight-card hands (about 14 min on 4 threads) into `data/misses-8.b64.txt` and `data/summary-8.json`, and `node probability.js 8` writes `data/probability-8.csv`.

`index.html` is the visualization: three.js from a CDN, with no build step. It only reads the saved data and never recomputes anything.

## Reproduce it

Requires Node 18 or later and Python 3 (for the local server).

```sh
git clone https://github.com/nathanliow/nine-card-reach.git
cd nine-card-reach

# Optional: regenerate the data (about 15 min on an 8-core M1 Pro, about 4 GB RAM)
node precompute.js 6        # 6 = number of worker threads

# View it. The page loads data/ with fetch, so serve the folder instead of opening the file directly.
python3 -m http.server
# open http://localhost:8000
```

To change the target range or the intermediate cap, edit `TARGET` and `M` at the top of `engine.js`. A cap of about 2× the largest target worked well. The page assumes 10,000 targets, and the fun facts in `index.html` are hardcoded from this run, so re-derive them if the data changes.
