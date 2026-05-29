const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const authGuard = require("../utils/authGuard");
const { readJSON, writeJSON } = require("../utils/fileDB");

const USER_DB = "./database/users.json";
const SUBJECT_DB = "./database/subjects.json";
const PLANNER_DB = "./database/planner.json";

const { createCalendarEvent } = require("../services/apis/googleCalendar");

function ensureIntegrations(user) {
  if (!user.integrations) {
    user.integrations = {
      google: null,
    };
  }
}

/* ================= PROFILE PAGE ================= */

router.get("/", authGuard, async (req, res) => {
  const users = await readJSON(USER_DB);
  const subjectsDB = await readJSON(SUBJECT_DB);
  const plannerDB = await readJSON(PLANNER_DB);

  const user = users.find(u => u.userId === req.session.user.id);
  if (!user) return res.redirect("/auth/login");
  ensureIntegrations(user);

  const subjects = subjectsDB[user.userId]?.subjects || {};
  const plannerUser = plannerDB.users?.[user.userId] || {};

  res.render("profile", {
    user,
    totalSubjects: Object.keys(subjects).length,
    totalProjects: Object.keys(plannerUser.projects || {}).length,
    totalTasks: plannerUser.global?.items?.length || 0,
    googleConnected: !!user.integrations.google
  });
});

/* ================= UPDATE NAME ================= */

router.post("/update-name", authGuard, async (req, res) => {
  const users = await readJSON(USER_DB);
  const index = users.findIndex(u => u.userId === req.session.user.id);

  if (index !== -1) {
    users[index].name = req.body.name;
    await writeJSON(USER_DB, users);
    req.session.user.name = req.body.name;
  }

  res.redirect("/profile");
});

/* ================= CHANGE PASSWORD ================= */

router.post("/change-password", authGuard, async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.send("Passwords do not match");
  }

  const users = await readJSON(USER_DB);
  const index = users.findIndex(u => u.userId === req.session.user.id);

  if (index === -1) return res.redirect("/profile");

  const hashed = await bcrypt.hash(newPassword, 10);
  users[index].password = hashed;

  await writeJSON(USER_DB, users);
  res.redirect("/profile");
});

const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI,
);

/* ================= CONNECT GOOGLE ================= */

router.get("/google/connect", authGuard, (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // 🔥 important
    scope: ["https://www.googleapis.com/auth/calendar"],
  });

  res.redirect(url);
});

/* ================= GOOGLE CALLBACK ================= */

router.get("/google/callback", authGuard, async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) return res.redirect("/profile");

    const { tokens } = await oauth2Client.getToken(code);

    const users = await readJSON(USER_DB);
    const index = users.findIndex((u) => u.userId === req.session.user.id);

    if (index === -1) return res.redirect("/profile");

    ensureIntegrations(users[index]);

    users[index].integrations.google = {
      connected: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      },
    };

    await writeJSON(USER_DB, users);

    res.redirect("/profile");
  } catch (err) {
    console.error("Google OAuth Error:", err);
    res.redirect("/profile");
  }
});

/* ================= GOOGLE DISCONNECT ================= */

router.get("/google/disconnect", authGuard, async (req, res) => {

  const users = await readJSON(USER_DB);
  const index = users.findIndex(u => u.userId === req.session.user.id);

  if (index !== -1 && users[index].integrations) {
    users[index].integrations.google = null;
    await writeJSON(USER_DB, users);
  }

  res.redirect("/profile");
});

module.exports = router;