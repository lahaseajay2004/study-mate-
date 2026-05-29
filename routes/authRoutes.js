const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const { readJSON, writeJSON } = require("../utils/fileDB");

const USER_DB = "./database/users.json";

function ensureUserIntegrations(user) {
  if (!user.integrations) {
    user.integrations = { google: null };
  }
}
// Render login
router.get("/login", (req, res) => {
  res.render("login");
});

// Render register
router.get("/register", (req, res) => {
  res.render("register");
});

// Register
router.post("/register", async (req, res) => {
  const users = await readJSON(USER_DB);
  const hashed = await bcrypt.hash(req.body.password, 10);

  users.push({
    userId: "u" + Date.now(),
    name: req.body.name,
    email: req.body.email,
    password: hashed,
    createdAt: new Date().toISOString(),

    // 🔌 OPTIONAL INTEGRATIONS
    integrations: {
      google: null,
    },
  });

  await writeJSON(USER_DB, users);
  res.redirect("/auth/login");
});

// Login
router.post("/login", async (req, res) => {
  const users = await readJSON(USER_DB);
  const user = users.find(u => u.email === req.body.email);

  if (!user) return res.send("User not found");

  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.send("Wrong password");

  ensureUserIntegrations(user);

  // Store full minimal user info in session
  req.session.user = {
    id: user.userId,
    name: user.name
  };

  /* ================= AUTO CONTEXT INIT ================= */

  const SUBJECT_DB = "./database/subjects.json";
  const subjectsDB = await readJSON(SUBJECT_DB);

  const userSubjects = subjectsDB[user.userId]?.subjects || {};

  if (Object.keys(userSubjects).length > 0) {
    const firstSubjectId = Object.keys(userSubjects)[0];

    req.session.activeContext = {
      scope: "subject",
      subjectId: firstSubjectId,
      context: "general"
    };
  } else {
    req.session.activeContext = {
      scope: "global",
      subjectId: null,
      context: "general"
    };
  }

  req.session.save(err => {
    if (err) {
      console.error("Session save error:", err);
      return res.redirect("/auth/login");
    }

    console.log("Session Started:", req.session);
    res.redirect("/dashboard");
  });
});

// Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/auth/login");
  });
});

module.exports = router;
