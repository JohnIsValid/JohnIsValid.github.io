const fs = require("fs");
const path = require("path");

const mdDir = path.resolve(__dirname, "..", "myPage", "md");
const outputPath = path.join(mdDir, "articles.json");

const files = fs
  .readdirSync(mdDir)
  .filter((name) => name.toLowerCase().endsWith(".md"))
  .sort((left, right) => left.localeCompare(right, "zh-CN"));

const manifest = files.map((fileName) => ({
  fileName,
  url: encodeURIComponent(fileName),
}));

fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${path.relative(process.cwd(), outputPath)} with ${files.length} articles.`);
