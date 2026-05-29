const express = require("express");
const router = express.Router();
const { readJSON, writeJSON } = require("../utils/fileDB");

const USER_DB = "./data/users.json";

// Get current user
router.get("/current", async (req, res) => {
  const users = await readJSON(USER_DB);
  res.json(users[0]); // single-user mode for now
});

module.exports = router;
