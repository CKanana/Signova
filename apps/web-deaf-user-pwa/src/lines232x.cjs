const fs = require("fs");
const c = fs.readFileSync("src/screens/LiveSigningScreen.tsx", "utf8");
const lines = c.split("\n");
for (let ln = 2324; ln <= 2332; ln++) {
  console.log("LINE", ln, JSON.stringify(lines[ln - 1]));
}
