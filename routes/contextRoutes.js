const express = require("express");
const router = express.Router();
const { readJSON } = require("../utils/fileDB");
const authGuard = require("../utils/authGuard");

router.get("/switch", authGuard, async (req, res) => {
  const subjects = await readJSON("./database/subjects.json");
  const projects = await readJSON("./database/projects.json");

  res.render("contextSwitch", { subjects, projects });
});

router.post("/activate", authGuard, (req, res) => {
  req.session.activeContext = {
    type: req.body.type,
    id: req.body.id
  };
  console.log("Session:updated=>>", req.session);
  res.redirect("/");
});

module.exports = router;
