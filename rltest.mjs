import rateLimit from 'express-rate-limit';
const lr = rateLimit({ windowMs: 15*60*1000, max: 3, standardHeaders: true, legacyHeaders: false, skip: () => false });
const results = [];
for (let i = 0; i < 6; i++) {
  const req = {};
  const res = { get: () => {}, set: () => {} };
  lr(req, res, (err) => {
    if (err) results.push("429"); else results.push("200");
  });
}
console.log(JSON.stringify(results));
