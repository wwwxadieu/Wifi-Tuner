const fs = require("fs");
const path = require("path");

// Server Next.js standalone được đóng gói qua `extraResources`. electron-builder
// tự động xoá mọi thư mục `node_modules` nằm ở gốc nguồn copy, nên một config
// tưởng chừng hợp lý vẫn có thể đóng gói "thành công" rồi app lại crash ngay
// khi mở với lỗi "Cannot find module 'next'". Kiểm tra ở đây để build fail sớm
// thay vì phát hiện sau khi cài lên máy người dùng.
const REQUIRED = [
  path.join("standalone", "server.js"),
  path.join("standalone", "package.json"),
  path.join("standalone", ".next", "static"),
  path.join("standalone", "node_modules", "next", "package.json"),
  path.join("standalone", "node_modules", "react", "package.json"),
];

function resourcesDir(context) {
  if (context.electronPlatformName === "darwin") {
    const app = `${context.packager.appInfo.productFilename}.app`;
    return path.join(context.appOutDir, app, "Contents", "Resources");
  }
  return path.join(context.appOutDir, "resources");
}

module.exports = async function afterPack(context) {
  const resources = resourcesDir(context);
  const missing = REQUIRED.filter((rel) => !fs.existsSync(path.join(resources, rel)));

  if (missing.length > 0) {
    throw new Error(
      `Packaged app is missing required files under ${resources}:\n` +
        missing.map((rel) => `  - ${rel}`).join("\n") +
        `\n\nThe app would start and immediately fail with "Server process exited early".` +
        `\nCheck the extraResources config in package.json.`
    );
  }

  console.log(`  • verified bundled server  platform=${context.electronPlatformName} arch=${context.arch}`);
};
