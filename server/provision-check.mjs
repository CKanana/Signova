import { connectDatabase } from './src/config/db.js';
import { User } from './src/models/user.js';
import { Organization } from './src/models/organization.js';
import { SetupToken } from './src/models/setupToken.js';
import { Teller } from './src/models/teller.js';

await connectDatabase();

const knh = await Organization.findOne({ shortName: 'KNH' }).lean();
const admin = await User.findOne({ email: 'crystal.kanana@strathmore.edu' }).select('+passwordHash +totpSecret').lean();
const tokenCount = await SetupToken.countDocuments({ user: admin._id, scope: 'bootstrap', usedAt: { $exists: false } });
const tellers = await Teller.countDocuments({ organization: knh._id });

console.log(JSON.stringify({
  knh: !!knh,
  adminExists: !!admin,
  adminActive: admin?.isActive,
  adminRole: admin?.role,
  hasPasswordHash: !!admin?.passwordHash,
  hasTotpSecret: !!admin?.totpSecret,
  pendingBootstrapTokens: tokenCount,
  tellers,
}));
