const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.error("Missing .next/standalone — run `next build` with ELECTRON_BUILD=1 first.");
  process.exit(1);
}

const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(standalone, "public"), { recursive: true });
}
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});

console.log("Prepared .next/standalone for Electron packaging.");
