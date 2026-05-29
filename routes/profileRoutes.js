const express = require("express");
const router = express.Router();
const authGuard = require("../utils/authGuard");
const { readJSON } = require("../utils/fileDB");

const USER_DB = "./database/users.json";

router.get("/", authGuard, async (req, res) => {
  const users = await readJSON(USER_DB);
  const userId = req.session.user.id;

  const user = users.find(u => u.userId === userId);

  if (!user) {
    return res.send("User not found in database");
  }

  res.render("profile", {
    user
  });
});

module.exports = router;
