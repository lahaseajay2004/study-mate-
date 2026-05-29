const apis = require("./apiServices");
const fs = require("fs");
const path = require("path");

const FILE = path.join("../study_mate/database/apiHistory.json");
const MAX = 10;

// ---------------- History Helpers ----------------
function readHistory() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf-8"));
}

function writeHistory(items) {
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2));
}

function addToHistory(newItems) {
  const history = readHistory();

  newItems.forEach(item => {
    // Remove duplicates
    if (!history.find(h => h.query === item.query && h.source === item.source)) {
      history.unshift(item);
    }
  });

  const trimmed = history.slice(0, MAX);
  writeHistory(trimmed);
}

// Search history first
function searchHistory(query, selectedApis) {
  const history = readHistory();
  return history.filter(item => {
    // ensure both source and query exist
    if (!item.source || !item.query) return false;

    const apiKey = item.source.toLowerCase();

    // check selectedApis has this source
    if (!selectedApis[apiKey]) return false;

    // check query match
    return item.query.toLowerCase() === query.toLowerCase();
  });
}

// ---------------- API Search ----------------
async function searchApis(query, selectedApis) {
  // 1️⃣ Try history first
  const cached = searchHistory(query, selectedApis);
  if (cached.length > 0) {
    console.log("Returned from history:", cached.map(c => c.source));
    return cached;
  }
  else{
    console.log("searche query:",query,"\n",selectedApis,"\n")
  }

  // 2️⃣ If nothing in history, hit APIs
  const tasks = [];
  if (selectedApis.wikipedia) tasks.push(apis.wikipedia(query));
  if (selectedApis.wikidata) tasks.push(apis.wikidata(query));
  if (selectedApis.openalex) tasks.push(apis.openalex(query));
  if (selectedApis.duckduckgo) tasks.push(apis.duckduckgo(query));
  if (selectedApis.unsplash) tasks.push(apis.unsplash(query));

  const settled = await Promise.allSettled(tasks);

  const sources = settled
    .filter(r => r.status === "fulfilled")
    .map(r => r.value);

  // Store results in history
  sources.forEach(src => {
    if (src.results?.length) {
      // Save with query reference
      const itemsToStore = src.results.map(r => ({
        ...r,
        query,
        source: src.source
      }));
      addToHistory(itemsToStore);
    }
  });

  return sources;
}

module.exports = { searchApis, addToHistory, getHistory: readHistory };