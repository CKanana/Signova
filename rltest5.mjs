import rateLimit from 'express-rate-limit';
// module load-time import with max=3
const lr = rateLimit({ windowMs: 15*60*1000, max: 3, standardHeaders: true, legacyHeaders: false, skip: () => false });
const results = [];
const reqs = Array.from({length: 5}, () => ({ ip: '1.2.3.4' }));
const res = { get: () => {}, set: () => {} };
let count = 0;
for (const r of reqs) {
  lr(r, res, (err) => {
    results.push(err ? '429' : '200');
    count++;
    if (count === 5) console.log(JSON.stringify(results));
  });
}
