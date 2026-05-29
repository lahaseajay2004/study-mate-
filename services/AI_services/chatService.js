const { readJSON, writeJSON } = require("../../utils/fileDB");

const CHAT_DB = "./database/chats.json";

async function createChat(userId, subjectId, title = "New Chat") {
  const db = await readJSON(CHAT_DB, {});

  if (!db[userId]) db[userId] = {};
  if (!db[userId][subjectId]) db[userId][subjectId] = [];

  const chatId = "chat_" + Date.now();

  const chat = {
    chatId,
    title,
    createdAt: new Date().toISOString(),
  };

  db[userId][subjectId].push(chat);

  await writeJSON(CHAT_DB, db);

  return chat;
}

async function getChats(userId, subjectId) {
  const db = await readJSON(CHAT_DB, {});

  return db[userId]?.[subjectId] || [];
}

module.exports = { createChat, getChats };
