const express = require("express");
const router = express.Router();
const authGuard = require("../utils/authGuard");
const { getUserId } = require("../utils/userContext");
const {getUserSubjects}=require("../services/subjectService")

const { chatWithAI } = require("../services/AI_services/aiService");
const { createUpload } = require("../utils/userUplodes");
const { readPDF } = require("../utils/fileManger");
const {loadShortMemory} =require("../services/AI_services/aiMemory")

// ONE uploader for both fields
const upload = createUpload("aichat", "files").fields([
  { name: "image", maxCount: 1 },
  { name: "pdf", maxCount: 1 },
]);

// Chat UI
router.get("/", authGuard, (req, res) => {
  res.render("chat");
});

// Chat endpoint
router.post("/send", authGuard, upload, async (req, res) => {
  console.log("HIT /send", req.body.message);

  try {
    const userId = getUserId(req);

    const subjectId = req.body.subjectId;
    const chatId = req.body.chatId;
    const message = req.body.message || "";

    if (!subjectId || !chatId) {
      return res.status(400).json({
        error: "Missing subjectId or chatId",
      });
    }

    const files = [];

    /* ======================
       IMAGE UPLOAD
    ====================== */

    if (req.files?.image) {
      const img = req.files.image[0];

      const imgUrl = `/uploads/users/${userId}/aichat/files/${img.filename}`;

      files.push({
        type: "image",
        url: imgUrl,
      });
    }

    /* ======================
       PDF UPLOAD
    ====================== */

    if (req.files?.pdf) {
      const pdf = req.files.pdf[0];

      const text = await readPDF(userId, "aichat/files", pdf.filename);

      files.push({
        type: "pdf",
        filename: pdf.filename,
        text,
      });
    }

    /* ======================
       AI CALL
    ====================== */

    const aiResponse = await chatWithAI(
      {
        userId,
        subjectId,
        chatId,
        message,
      },
      files,
    );

    /* ======================
       RESPONSE
    ====================== */

    res.json({
      reply: aiResponse.text,
      triggers: aiResponse.triggers || [],
      results: aiResponse.results || [],
    });
    console.log("============================================================================\n");
    console.log("AI REPLIED:", aiResponse.text);
  } catch (err) {
    console.error("AI ERROR:", err);

    res.status(500).json({
      error: "AI failed",
    });
  }
});

const { createChat, getChats } = require("../services/AI_services/chatService");

/* ======================
   GET SUBJECTS FOR CHAT
====================== */

router.get("/subjects", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);

    const subjectsObj = await getUserSubjects(userId);
    const subjects = Object.values(subjectsObj || {});
    console.log("subjects",subjects);
    res.json({
      subjects,
    });
    
  } catch (err) {
    console.error("SUBJECT LOAD ERROR:", err);

    res.status(500).json({
      error: "Failed to load subjects",
    });
  }
});


/* GET CHATS FOR SUBJECT */

router.get("/:subjectId", authGuard, async (req, res) => {
  const userId = getUserId(req);
  const subjectId = req.params.subjectId;

  const chats = await getChats(userId, subjectId);

  // 🔥 FILTER OUT NOTE CHATS
  const filtered = chats.filter(
    (c) => !c.title || !c.title.includes("note_")
  );

  res.json(filtered);
});

/* CREATE CHAT */

router.post("/create", authGuard, async (req, res) => {
  const userId = getUserId(req);

  const { subjectId, title } = req.body;

  const chat = await createChat(userId, subjectId, title);

  res.json(chat);
});

router.get("/history/:subjectId/:chatId", authGuard, async (req,res)=>{

const userId = getUserId(req)

const {subjectId,chatId} = req.params

const memory = await loadShortMemory(userId,subjectId,chatId)

res.json({
messages: memory.messages || []
})

})

const SUBJECT_DB = "./database/subjects.json";


module.exports = router;
