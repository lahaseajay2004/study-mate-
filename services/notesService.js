const fs = require("fs");
const path = require("path");
const { readJSON, writeJSON } = require("../utils/fileDB");

const NOTES_DB = "./database/notes.json";
const UPLOAD_BASE = "./database/uploads/users";

/* =====================================================
   INTERNAL HELPERS
===================================================== */

async function loadNotes() {
  const data = await readJSON(NOTES_DB);
  return Array.isArray(data) ? data : [];
}

async function saveNotes(notes) {
  await writeJSON(NOTES_DB, notes);
}

function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function ensureUserNoteImageFolder(userId) {
  const dir = path.join(UPLOAD_BASE, userId, "notes", "images");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getNoteImagePath(userId, filename) {
  const dir = ensureUserNoteImageFolder(userId);
  return path.join(dir, filename);
}

function getPublicImagePath(userId, filename) {
  return `/uploads/users/${userId}/notes/images/${filename}`;
}

/* =====================================================
   NOTE CRUD
===================================================== */

async function createNote(note) {
  const notes = await loadNotes();

  const newNote = {
    noteId: generateId("note"),
    userId: note.userId,
    title: note.title || "Untitled",
    blocks: note.blocks || [ {
    id: "block_" + Date.now(),
    type: "text",
    content: ""
  }],
    tags: note.tags || [],
    scope: note.scope || "global",
    subjectId: note.subjectId || null,
    context: note.context || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  notes.push(newNote);
  await saveNotes(notes);
  return newNote;
}

async function updateNote(noteId, updatedData) {
  const notes = await loadNotes();
  const note = notes.find(n => n.noteId === noteId);
  if (!note) return false;

  Object.assign(note, updatedData);
  note.updatedAt = new Date().toISOString();

  await saveNotes(notes);
  return note;
}

async function deleteNote(noteId) {
  const notes = await loadNotes();
  const filtered = notes.filter(n => n.noteId !== noteId);
  await saveNotes(filtered);
}

/* =====================================================
   BLOCK MANIPULATION
===================================================== */

/*
 Block structure:
 {
   id: "block_xxx",
   type: "heading" | "paragraph" | "list" | "code" | "image",
   content: "text",
   meta: {}
 }
*/

async function addBlock(noteId, blockData) {
  const notes = await loadNotes();
  const note = notes.find(n => n.noteId === noteId);
  if (!note) return false;

  const newBlock = {
    id: generateId("block"),
    type: blockData.type || "text",
    content: blockData.content || "",
    meta: blockData.meta || {}
  };

  note.blocks.push(newBlock);
  note.updatedAt = new Date().toISOString();

  await saveNotes(notes);
  return newBlock;
}

async function updateBlock(noteId, blockId, updatedData) {
  const notes = await loadNotes();
  const note = notes.find(n => n.noteId === noteId);
  if (!note) return false;

  const block = note.blocks.find(b => b.id === blockId);
  if (!block) return false;

  Object.assign(block, updatedData);
  note.updatedAt = new Date().toISOString();

  await saveNotes(notes);
  return block;
}

async function deleteBlock(noteId, blockId) {
  const notes = await loadNotes();
  const note = notes.find(n => n.noteId === noteId);
  if (!note) return false;

  note.blocks = note.blocks.filter(b => b.id !== blockId);
  note.updatedAt = new Date().toISOString();

  await saveNotes(notes);
  return true;
}

async function reorderBlocks(noteId, newOrderArray) {
  /*
   newOrderArray = ["block_1", "block_3", "block_2"]
  */

  const notes = await loadNotes();
  const note = notes.find(n => n.noteId === noteId);
  if (!note) return false;

  const reordered = [];

  newOrderArray.forEach(id => {
    const block = note.blocks.find(b => b.id === id);
    if (block) reordered.push(block);
  });

  note.blocks = reordered;
  note.updatedAt = new Date().toISOString();

  await saveNotes(notes);
  return true;
}

/* =====================================================
   NOTE FETCHING
===================================================== */

async function getNotesByUser(userId) {
  const notes = await loadNotes();
  return notes.filter(n => n.userId === userId);
}
async function getNoteById(noteId) {
  const notes = await loadNotes();
  return notes.find(n => n.noteId === noteId) || null;
}
async function getNotesFiltered({ userId, scope, subjectId, context }) {
  const notes = await loadNotes();

  return notes.filter(n => {
    if (n.userId !== userId) return false;
    if (scope && n.scope !== scope) return false;
    if (scope === "subject" && subjectId && n.subjectId !== subjectId) return false;
    if (context && n.context !== context) return false;
    return true;
  });
}

/* =====================================================
   AI FEED FUNCTION
===================================================== */

/*
 Used by AIHub to fetch structured content
 for summarization / context injection.
*/

async function getNotesForAI(userId, options = {}) {
  const notes = await getNotesByUser(userId);

  const limited = notes
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, options.limit || 10);

  return limited.map(note => ({
    noteId: note.noteId,
    title: note.title,
    content: note.blocks
      .map(b => `[${b.type}] ${b.content}`)
      .join("\n")
  }));
}

/* =====================================================
   AI TRIGGER EXECUTION FUNCTIONS
===================================================== */

/*
 IMPORTANT:
 These functions DO NOT detect triggers.
 AIHub detects triggers like:

   #addnote(...)
   #updateblock(...)
   #addblock(...)

 And then calls these functions directly.
*/

/* -------- AI ADD NOTE --------
AIHub should call:

aiAddNote(userId, {
  title: "Math Notes",
  blocks: [
    { type: "heading", content: "Integration" },
    { type: "paragraph", content: "Definition..." }
  ],
  tags: ["math"]
});
--------------------------------*/
async function aiAddNote(userId, data) {
  return await createNote({
    userId,
    title: data.title,
    blocks: data.blocks,
    tags: data.tags,
    scope: data.scope || "global"
  });
}

/* -------- AI UPDATE NOTE --------
AIHub should call:

aiUpdateNote(userId, noteId, {
  title: "Updated Title"
});
--------------------------------*/
async function aiUpdateNote(userId, noteId, updatedData) {
  const notes = await loadNotes();
  const note = notes.find(n => n.noteId === noteId && n.userId === userId);
  if (!note) return false;

  Object.assign(note, updatedData);
  note.updatedAt = new Date().toISOString();

  await saveNotes(notes);
  return note;
}

/* -------- AI ADD BLOCK --------
AIHub should call:

aiAddBlock(noteId, {
  type: "paragraph",
  content: "New explanation added by AI"
});
--------------------------------*/
async function aiAddBlock(noteId, blockData) {
  return await addBlock(noteId, blockData);
}

/* -------- AI UPDATE BLOCK --------
AIHub should call:

aiUpdateBlock(noteId, blockId, {
  content: "Refined explanation"
});
--------------------------------*/
async function aiUpdateBlock(noteId, blockId, updatedData) {
  return await updateBlock(noteId, blockId, updatedData);
}

/* -------- AI DELETE BLOCK --------
AIHub should call:

aiDeleteBlock(noteId, blockId);
--------------------------------*/
async function aiDeleteBlock(noteId, blockId) {
  return await deleteBlock(noteId, blockId);
}

/* =====================================================
   EXPORTS
===================================================== */

module.exports = {
  createNote,
  updateNote,
  deleteNote,
  getNotesByUser,
  getNotesFiltered,
  getNoteById,
  ensureUserNoteImageFolder,

  addBlock,
  updateBlock,
  deleteBlock,
  reorderBlocks,

  getNotesForAI,

  aiAddNote,
  aiUpdateNote,
  aiAddBlock,
  aiUpdateBlock,
  aiDeleteBlock,

  getNoteImagePath,
  getPublicImagePath
};