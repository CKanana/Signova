import rateLimit from 'express-rate-limit';
// Use the engine directly via the middleware factory
const lr = rateLimit({ windowMs: 15*60*1000, max: 3, standardHeaders: true, legacyHeaders: false, skip: () => false });
const results = [];
const calls = [];
for (let i = 0; i < 6; i++) {
  const req = { ip: '1.2.3.4' };
  const res = { get: () => {}, set: () => {} };
  lr(req, res, (err) => {
    calls.push(err ? '429' : '200');
  });
}
// Wait for all calls (events are synchronous within the call)
console.log(JSON.stringify(calls));
