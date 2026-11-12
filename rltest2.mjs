import rateLimit from 'express-rate-limit';
const lr = rateLimit({ windowMs: 15*60*1000, max: 3, standardHeaders: true, legacyHeaders: false, skip: () => false });
const results = [];
for (let i = 0; i < 6; i++) {
  const req = { ip: '1.2.3.4' };
  const res = { get: () => {}, set: () => {} };
  lr(req, res, (err) => {
    if (err) results.push("429"); else results.push("200");
  });
}
// the middleware is called once; the limiter is async; run multiple handles
// Actually the limiter engine is invoked per call. Let's just call the
// exported middleware directly N times with the same req.ip.
console.log(JSON.stringify(results));
