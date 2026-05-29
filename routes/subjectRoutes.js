const express = require("express");
const router = express.Router();
const { readJSON, writeJSON } = require("../utils/fileDB");
const {getUserId}=require("../utils/userContext");
const authGuard = require("../utils/authGuard");

const SUBJECT_DB = "./database/subjects.json";

/* ===================== GET SUBJECTS ===================== */
router.get("/", authGuard,async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.redirect("/login");
    }

    const db = await readJSON(SUBJECT_DB);
    const userSubjects = db[userId]?.subjects || {};

    res.render("subjects", {
      subjects: Object.values(userSubjects)
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading subjects");
  }
});

/* ===================== CREATE SUBJECT ===================== */
router.post("/create",authGuard, async (req, res) => {
  try {
    console.log("FULL SESSION:", req.session);
    

    const userId = getUserId(req);
    const db = await readJSON(SUBJECT_DB);

    if (!db[userId]) {
      db[userId] = { subjects: {} };
    }

    const subjectId = "sub_" + Date.now();

    db[userId].subjects[subjectId] = {
      subjectId,
      name: req.body.name,
      description: req.body.description || "",
      aiConfig: {
        instructions: req.body.instructions || "",
        model: req.body.model || "meta-llama/llama-3-8b-instruct",
        temperature: 0.4
      },
      apiConfig: {
        enabledApis: [],
        maxSources: 5
      },
      createdAt: new Date().toISOString()
    };

    await writeJSON(SUBJECT_DB, db);

    res.json({ success: true, subjectId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error creating subject" });
  }
});

module.exports = router;