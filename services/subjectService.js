const { readJSON, writeJSON } = require("../utils/fileDB");
const SUBJECT_DB = "./database/subjects.json";

/* ================= GET USER SUBJECTS ================= */
async function getUserSubjects(userId) {
  const db = await readJSON(SUBJECT_DB);
  return db[userId]?.subjects || {};
}

/* ================= CREATE SUBJECT ================= */
async function createSubject(userId, data) {
  const db = await readJSON(SUBJECT_DB);

  if (!db[userId]) db[userId] = { subjects: {} };

  const subjectId = "sub_" + Date.now();

  db[userId].subjects[subjectId] = {
    subjectId,
    name: data.name,
    description: data.description || "",
    aiConfig: {
      instructions: data.instructions || "",
      model: data.model || "meta-llama/llama-3-8b-instruct",
      temperature: 0.4
    },
    apiConfig: {
      enabledApis: [],
      maxSources: 5
    },
    createdAt: new Date().toISOString()
  };

  await writeJSON(SUBJECT_DB, db);
  return subjectId;
}

/* ================= DELETE SUBJECT ================= */
async function deleteSubject(userId, subjectId) {
  const db = await readJSON(SUBJECT_DB);
  if (!db[userId]) return;

  delete db[userId].subjects[subjectId];
  await writeJSON(SUBJECT_DB, db);
}

/* ================= SWITCH CONTEXT ================= */
function switchSubject(req, subjectId) {
  req.session.activeContext = {
    type: "subject",
    id: subjectId
  };
}

module.exports = {
  getUserSubjects,
  createSubject,
  deleteSubject,
  switchSubject
};