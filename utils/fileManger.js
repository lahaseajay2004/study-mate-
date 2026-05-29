const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

function getUserPath(userId, type, category) {

  return path.join(
    "database",
    "uploads",
    "users",
    userId,
    type,
    category
  );
}

function listFiles(userId, type, category) {

  const folder = getUserPath(userId, type, category);

  if (!fs.existsSync(folder)) return [];

  return fs.readdirSync(folder);
}

function deleteFile(userId, type, category, filename) {

  const filePath = path.join(
    getUserPath(userId, type, category),
    filename
  );

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }

  return false;
}

async function readPDF(userId, type, filename) {

  const filePath = path.join(
    getUserPath(userId, type, "pdfs"),
    filename
  );

  const data = await pdf(fs.readFileSync(filePath));

  return data.text;
}

function getFileURL(userId, type, category, filename) {

  return `http://localhost:3000/database/uploads/users/${userId}/${type}/${category}/${filename}`;
}

module.exports = {
  listFiles,
  deleteFile,
  readPDF,
  getFileURL
};