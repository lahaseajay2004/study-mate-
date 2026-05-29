const express = require("express");
const router = express.Router();
const authGuard = require("../utils/authGuard");
const { getUserId } = require("../utils/userContext");

const { getUserSubjects } = require("../services/subjectService");
const { getNotesByUser } = require("../services/notesService");
const { getHistory, searchApis } = require("../services/apis/apiHub");
const { chatWithAI } = require("../services/AI_services/aiService");
const { readJSON } = require("../utils/fileDB");
const {getTasks,getAllTasks}=require("../services/plannerService")

/* ============================================================
   DASHBOARD MAIN VIEW
============================================================ */
router.get("/", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);
    const activeContext = req.session.activeContext || null;
    const scope = req.query.scope || "global";
    const projectId = req.query.projectId || null;

    /* ================= DATABASE ================= */
    const db = await readJSON("./database/planner.json");
    const user = db.users?.[userId];

    /* ================= SUBJECTS ================= */
    const subjectsObj = await getUserSubjects(userId);
    const subjects = Object.values(subjectsObj || {});

    /* ================= NOTES ================= */
    const notes = await getNotesByUser(userId);

    /* ================= PROJECTS + ITEMS ================= */
    const tasks = await getAllTasks(userId);
    const tasksPreview = tasks
    .filter(task => task.status === "todo")
    .slice(0, 5);
    //console.log(tasksPreview,tasks);

    /* ================= API HISTORY ================= */
    const apiHistory = getHistory() || [];

    /* ================= RENDER ================= */
    res.render("dashboard", {
      user: req.session.user,
      session: req.session,

      subjects,
      notes,
      tasksPreview,

      scope,
      projectId,
      activeContext,

      apiHistory,

      aiInit: {
        welcome: "Hi! I'm your StudyMate AI. Ask me anything.",
        lastTriggers: []
      }
    });

  } catch (err) {
    console.error("Dashboard load failed:", err.message);
    res.status(500).send("Something went wrong loading dashboard.");
  }
});
/*--------------------------------api-search---------------------------------*/

router.post("/api-search", authGuard, async (req, res) => {
  try {
    const { query, wikipedia, wikidata, openalex, duckduckgo } = req.body;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Search query required" });
    }

    const selectedApis = {
      wikipedia: !!wikipedia,
      wikidata: !!wikidata,
      openalex: !!openalex,
      duckduckgo: !!duckduckgo
    };

    const results = await searchApis(query, selectedApis);

    return res.json({
      success: true,
      results,
      history: getHistory()
    });

  } catch (err) {
    console.error("API search error:", err.message);
    res.status(500).json({ error: "API search failed" });
  }
});

/*------------------------------------------ai-chat---------------------------------------------*/
router.post("/ai", authGuard, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message is required" });
    }

    const interpreted = await chatWithAI(message, req.session);

    return res.json({
      success: true,
      reply: interpreted.cleanText,
      triggers: interpreted.triggers || []
    });

  } catch (err) {
    console.error("AI error:", err.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

module.exports = router;