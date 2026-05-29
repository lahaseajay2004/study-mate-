const fs = require("fs-extra");

async function readJSON(path, fallback = {}) {
  try {
    return await fs.readJson(path);
  } catch {
    return fallback;
  }
}

async function writeJSON(path, data) {
  await fs.outputJson(path, data, { spaces: 2 });
}

module.exports = { readJSON, writeJSON };