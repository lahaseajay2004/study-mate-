const path = require("path");
const { readJSON, writeJSON } = require("../../utils/fileDB");

const DEFAULT_MAX = 6;

/* PATHS */
function subjectPath(userId, subjectId) {
  return `./database/memory/users/${userId}/subjects/${subjectId}`;
}

function basePath(userId, subjectId, chatId) {
  return `./database/memory/users/${userId}/subjects/${subjectId}/chats/${chatId}`;
}

function shortPath(userId, subjectId, chatId) {
  return basePath(userId, subjectId, chatId) + "/shortTerm.json";
}

function summaryPath(userId, subjectId, chatId) {
  return basePath(userId, subjectId, chatId) + "/summary.json";
}

function vectorPath(userId, subjectId, chatId) {
  return basePath(userId, subjectId, chatId) + "/vectors.json";
}

/* SHORT TERM */

async function loadShortMemory(userId, subjectId, chatId) {
  return await readJSON(shortPath(userId, subjectId, chatId), {
    messages: [],
    max: DEFAULT_MAX,
  });
}

async function saveShortMemory(userId, subjectId, chatId, data) {
  await writeJSON(shortPath(userId, subjectId, chatId), data);
}

/* SUMMARY */

async function loadSummary(userId, subjectId, chatId) {
  return await readJSON(summaryPath(userId, subjectId, chatId), {
    summary: "",
  });
}

async function saveSummary(userId, subjectId, chatId, summary) {
  await writeJSON(summaryPath(userId, subjectId, chatId), { summary });
}

/* VECTORS */

async function loadVectors(userId, subjectId) {
  const file = path.join(subjectPath(userId, subjectId), "vectors.json");

  const data = await readJSON(file, []);
  return data;
}

async function saveVectors(userId, subjectId, vectors) {
  if (vectors.length > 200) {
    vectors.splice(0, vectors.length - 200);
  }

  const file = path.join(subjectPath(userId, subjectId), "vectors.json");

  await writeJSON(file, vectors);
}

module.exports = {
  loadShortMemory,
  saveShortMemory,
  loadSummary,
  saveSummary,
  loadVectors,
  saveVectors,
};
