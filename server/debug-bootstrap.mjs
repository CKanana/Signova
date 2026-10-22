import { connectDatabase } from '../src/config/db.js';
import { seed } from '../src/seed/seed.js';
import { SetupToken } from '../src/models/setupToken.js';
import { hashToken, randomToken } from '../src/utils/crypto.js';
import { User } from '../src/models/user.js';

process.env.MONGODB_URI = 'placeholder';
await connectDatabase();
await seed();

const raw = randomToken(32);
const hash = hashToken(raw);
const user = await User.findOne({ email: 'crystal.kanana@strathmore.edu' });
await SetupToken.create({
  user: user._id,
  tokenHash: hash,
  scope: 'bootstrap',
  expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
});

const doc = await SetupToken.findOne({ tokenHash: hash });
console.log('found doc?', !!doc);
console.log('usedAt before', doc?.usedAt);

const consumed = await SetupToken.findOneAndUpdate(
  { tokenHash: hash, usedAt: { $exists: false } },
  { $set: { usedAt: new Date() } },
  { new: true }
);
console.log('consumed?', !!consumed);

await SetupToken.deleteMany({});
await User.deleteMany({});
