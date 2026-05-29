const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const axios = require("axios");
const fs = require("fs");

const authGuard = require("../utils/authGuard");
const { getUserId } = require("../utils/userContext");
const { getUserSubjects } = require("../services/subjectService");
const { searchApis } = require("../services/apis/apiHub");

const {
  createNote,
  deleteNote,
  getNotesFiltered,
  addBlock,
  updateBlock,
  deleteBlock,
  reorderBlocks,
  getNoteImagePath,
  getPublicImagePath,
  getNotesByUser,
  getNoteById,
  ensureUserNoteImageFolder,
} = require("../services/notesService");

const {
  createTask,
  toggleStep,
  getTasks,
  getTaskById,
} = require("../services/plannerService");

/* =====================================================
   IMAGE UPLOAD SETUP
===================================================== */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = getUserId(req);

    const dir = ensureUserNoteImageFolder(userId); // ✅ use this directly

    cb(null, dir);
  },

  filename: function (req, file, cb) {
    const uniqueName = "img_" + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

/* =====================================================
   GET NOTES PAGE
===================================================== */

router.get("/", authGuard, async (req, res) => {
  const userId = getUserId(req);

  const subjectsObj = await getUserSubjects(userId);
  const subjects = Object.values(subjectsObj || {});

  const notes = await getNotesByUser(userId);

  // Group notes by subjectId
  const groupedNotes = {};

  subjects.forEach((subject) => {
    groupedNotes[subject.subjectId] = [];
  });

  // Global bucket
  groupedNotes["global"] = [];

  notes.forEach((note) => {
    if (note.subjectId && groupedNotes[note.subjectId]) {
      groupedNotes[note.subjectId].push(note);
    } else {
      groupedNotes["global"].push(note);
    }
  });
  //console.log("NOTES:", groupedNotes);
  console.log("opened /notes");
  res.render("notes", {
    subjects,
    groupedNotes,
  });
});

/* =====================================================
   CREATE NOTE (BLOCK BASED)
===================================================== */

router.post("/create", authGuard, async (req, res) => {
  const userId = getUserId(req);
  const { title, subjectId } = req.body;
  const { activeContext } = req.session;

  await createNote({
    userId,
    title,
    blocks: [
      {
        id: "block_" + Date.now(),
        type: "text",
        content: "",
      },
    ],
    tags: [],
    scope: subjectId ? "subject" : "global",
    subjectId: subjectId || null,
    context: activeContext?.context || null,
  });

  res.redirect("/notes");
});
/* =====================================================
   DELETE NOTE
===================================================== */

router.post("/delete/:id", authGuard, async (req, res) => {
  await deleteNote(req.params.id);
  res.redirect("/notes");
});

/* =====================================================
   ADD BLOCK
===================================================== */

router.post("/:noteId/block/add", authGuard, async (req, res) => {
  const { noteId } = req.params;
  const { type, content } = req.body;

  await addBlock(noteId, {
    type,
    content,
  });

  res.json({ success: true });
});

/* =====================================================
   UPDATE BLOCK
===================================================== */

router.post("/:noteId/block/:blockId/update", authGuard, async (req, res) => {
  const { noteId, blockId } = req.params;
  const { content, meta } = req.body;

  await updateBlock(noteId, blockId, {
    content,
    meta,
  });

  res.json({ success: true });
});

/* =====================================================
   DELETE BLOCK
===================================================== */

router.post("/:noteId/block/:blockId/delete", authGuard, async (req, res) => {
  const { noteId, blockId } = req.params;

  await deleteBlock(noteId, blockId);
  res.json({ success: true });
});

/* =====================================================
   REORDER BLOCKS
===================================================== */

router.post("/:noteId/reorder", authGuard, async (req, res) => {
  const { noteId } = req.params;
  const { newOrder } = req.body;
  // newOrder must be array of block IDs

  await reorderBlocks(noteId, newOrder);
  res.json({ success: true });
});

/* =====================================================
   IMAGE UPLOAD
===================================================== */

router.post(
  "/:noteId/upload-image",
  authGuard,
  upload.single("image"),
  async (req, res) => {
    const userId = getUserId(req);
    const { noteId } = req.params;

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const publicPath = getPublicImagePath(userId, req.file.filename);

    // Add image block automatically
    await addBlock(noteId, {
      type: "image",
      content: publicPath,
    });

    res.json({
      success: true,
      imageUrl: publicPath,
    });
  },
);

router.get("/:noteId", authGuard, async (req, res) => {
  const userId = getUserId(req);
  const note = await getNoteById(req.params.noteId);
  if (!note) return res.status(404).json({ error: "Note not found" });

  // Collect all tasks linked in the note
  const taskBlocks = note.blocks.filter((b) => b.type === "task");
  const tasks = [];

  for (const block of taskBlocks) {
    if (block.meta?.tasks?.length) {
      for (const taskId of block.meta.tasks) {
        const task = await getTaskById(
          userId,
          block.meta.scope,
          taskId,
          block.meta.subjectId,
        );
        if (task) tasks.push(task);
      }
    }
  }

  res.json({ note, tasks });
});

//------------------------------------------api ingrection---------------------------------------------------------------------
/* =====================================================
   API SEARCH (Preview Results)
===================================================== */
router.post("/api/search", authGuard, async (req, res) => {
  const { query, selectedApis } = req.body;

  if (!query) {
    return res.status(400).json({ success: false, error: "Query required" });
  }

  try {
    const sources = await searchApis(query, selectedApis || {});
    res.json({ success: true, sources });
  } catch (err) {
    console.error("API search error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function downloadApiImage(userId, imageUrl) {
  try {
    const folder = ensureUserNoteImageFolder(userId);

    const ext = path.extname(imageUrl.split("?")[0]) || ".jpg";
    const filename = "api_" + Date.now() + ext;
    const filepath = path.join(folder, filename);

    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    fs.writeFileSync(filepath, response.data);

    return getPublicImagePath(userId, filename);
  } catch (err) {
    console.error("Image download failed:", err.message);
    return null;
  }
}

async function downloadApiImage(userId, imageUrl) {
  try {
    const folder = ensureUserNoteImageFolder(userId);

    const ext = path.extname(imageUrl.split("?")[0]) || ".jpg";
    const filename = "api_" + Date.now() + ext;
    const filepath = path.join(folder, filename);

    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    fs.writeFileSync(filepath, response.data);

    return getPublicImagePath(userId, filename);
  } catch (err) {
    console.error("Image download failed:", err.message);
    return null;
  }
}

/* =====================================================
   ADD API BLOCK TO NOTE
===================================================== */

router.post("/:noteId/block/add-api", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { noteId } = req.params;
    const { blockData } = req.body;

    if (!blockData) {
      return res
        .status(400)
        .json({ success: false, error: "No block data provided" });
    }

    let localImagePath = null;

    // If image exists → download it locally
    if (blockData.image) {
      localImagePath = await downloadApiImage(userId, blockData.image);
    }

    const apiBlock = {
      type: "api",
      content: {
        title: blockData.title,
        preview: blockData.preview,
        fullText: blockData.fullText || blockData.preview,
        image: localImagePath || blockData.image || null,
        url: blockData.url,
        source: blockData.source,
      },
    };

    await addBlock(noteId, apiBlock);

    res.json({ success: true });
  } catch (err) {
    console.error("Add API block error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//---------------------------------------------------task section-------------------------------------------------------
/* =====================================================
   CREATE TASK BLOCK (FROM NOTE)
===================================================== */

// POST /notes/:noteId/block/:blockId/add-task
router.post("/:noteId/block/:blockId/task/add", authGuard, async (req, res) => {
  const { noteId, blockId } = req.params;
  const { title } = req.body;
  const userId = getUserId(req);

  const note = await getNoteById(noteId);
  if (!note) return res.status(404).json({ error: "Note not found" });

  const block = note.blocks.find((b) => b.id === blockId);
  if (!block || block.type !== "task")
    return res.status(400).json({ error: "Invalid task block" });

  // Ensure meta and tasks array exist
  if (!block.meta) block.meta = {};
  if (!Array.isArray(block.meta.tasks)) block.meta.tasks = [];

  // Create the task in DB
  const task = await createTask(userId, {
    title,
    scope: block.meta.scope,
    subjectId: block.meta.subjectId,
  });

  // 🔥 Push the taskId into the block
  block.meta.tasks.push(task.taskId);

  // Save the updated block
  await updateBlock(noteId, blockId, { meta: block.meta });

  res.json({ success: true, task });
});
/* =====================================================
   TOGGLE TASK FROM NOTE BLOCK
===================================================== */

// POST /notes/task/:taskId/toggle
router.post("/task/:taskId/toggle", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId } = req.params;
    const { scope, subjectId } = req.body;

    const task = await toggleStep(userId, scope, taskId, null, subjectId); // use your planner function
    res.json({ success: true, task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a Task Block
// POST /notes/:noteId/block/add-task-block
// Add new task block
router.post("/:noteId/block/add-task-block", authGuard, async (req, res) => {
  const { noteId } = req.params;

  // Create a block with empty tasks array in meta
  const block = {
    type: "task",
    content: "",
    meta: { tasks: [], scope: "global" }, // initially empty tasks
  };

  await addBlock(noteId, block);

  res.json({ success: true });
});

router.post("/task/create", authGuard, async (req, res) => {
  const userId = getUserId(req);
  const { title, scope, subjectId, blockId } = req.body;

  if (!title)
    return res.status(400).json({ success: false, error: "Title required" });

  const task = await createTask(userId, { title, scope, subjectId });

  // store blockId in task meta to link to the block
  task.meta = { blockId };

  // save task again with blockId
  await toggleStep(userId, scope, task.taskId, null, subjectId); // optional, or just save meta

  res.json({ success: true, task });
});

// POST /notes/task/:taskId/delete
router.post("/task/:taskId/delete", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId } = req.params;
    const { scope, subjectId, noteId, blockId } = req.body;

    await deleteTask(userId, scope, taskId, subjectId);

    // Remove taskId from block meta
    const block = await getNoteBlock(noteId, blockId);
    if (block) {
      block.meta.tasks = (block.meta.tasks || []).filter((id) => id !== taskId);
      await updateBlock(noteId, blockId, block);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//---------------------white board
router.post("/:noteId/block/add-whiteboard", authGuard, async (req, res) => {
  const { noteId } = req.params;

  const newBlock = {
    id: "block_" + Date.now(),
    type: "whiteboard",
    content: "", // will store Fabric JSON later
    meta: {},
  };

  await addBlock(noteId, newBlock);

  res.json({ success: true });
});

// ------------------------------------------- TABLE ---------------------------------------------

// Add Table Block
router.post("/:noteId/block/add-table", authGuard, async (req, res) => {
  const { noteId } = req.params;
  const { rows = 3, cols = 3 } = req.body;

  const tableData = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ""),
  );

  const newBlock = {
    type: "table",
    content: {
      rows,
      cols,
      data: tableData,
    },
  };

  await addBlock(noteId, newBlock);

  res.json({ success: true });
});

// Update Table Cell
router.post(
  "/:noteId/block/:blockId/table/update-cell",
  authGuard,
  async (req, res) => {
    const { noteId, blockId } = req.params;
    const { row, col, value } = req.body;

    const note = await getNoteById(noteId);
    if (!note) return res.status(404).json({ success: false });

    const block = note.blocks.find((b) => b.id === blockId);
    if (!block || block.type !== "table")
      return res.status(404).json({ success: false });

    block.content.data[row][col] = value;

    await updateBlock(noteId, blockId, {
      content: block.content,
    });

    res.json({ success: true });
  },
);

// Add Row
router.post(
  "/:noteId/block/:blockId/table/add-row",
  authGuard,
  async (req, res) => {
    const { noteId, blockId } = req.params;

    const note = await getNoteById(noteId);
    if (!note) return res.status(404).json({ success: false });

    const block = note.blocks.find((b) => b.id === blockId);
    if (!block || block.type !== "table")
      return res.status(404).json({ success: false });

    const cols = block.content.cols;

    block.content.data.push(Array.from({ length: cols }, () => ""));
    block.content.rows += 1;

    await updateBlock(noteId, blockId, {
      content: block.content,
    });

    res.json({ success: true });
  },
);

// Add Column
router.post(
  "/:noteId/block/:blockId/table/add-col",
  authGuard,
  async (req, res) => {
    const { noteId, blockId } = req.params;

    const note = await getNoteById(noteId);
    if (!note) return res.status(404).json({ success: false });

    const block = note.blocks.find((b) => b.id === blockId);
    if (!block || block.type !== "table")
      return res.status(404).json({ success: false });

    block.content.data.forEach((row) => row.push(""));
    block.content.cols += 1;

    await updateBlock(noteId, blockId, {
      content: block.content,
    });

    res.json({ success: true });
  },
);
//----------------------------------------video secction-------------------------------
function getYoutubeId(url) {
  try {
    const u = new URL(url);

    // youtube.com/watch?v=
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v");
    }

    // youtu.be short links
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "");
    }
  } catch (err) {}

  return null;
}

function getYoutubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

async function getYoutubeTitle(videoId) {
  const url = "https://www.googleapis.com/youtube/v3/videos";

  const res = await axios.get(url, {
    params: {
      key: process.env.YOUTUBE_API_KEY,
      part: "snippet",
      id: videoId,
    },
  });

  return res.data.items[0]?.snippet?.title || "YouTube Video";
}
router.post("/:noteId/block/add-video", authGuard, async (req, res) => {
  const { noteId } = req.params;
  let { url, title, thumbnail } = req.body;

  const videoId = getYoutubeId(url);

  if (videoId) {
    if (!thumbnail) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }

    if (!title) {
      title = await getYoutubeTitle(videoId);
    }
  }

  const block = {
    type: "video",
    content: {
      url,
      title: title || "Video",
      thumbnail: thumbnail || null,
      notes: [],
    },
    meta: {},
  };

  await addBlock(noteId, block);

  res.json({ success: true });
});

router.post("/:noteId/video-note", authGuard, async (req, res) => {
  console.log("BODY:", req.body);
  const { noteId } = req.params;
  const { blockId, text, time } = req.body;

  const note = await getNoteById(noteId);

  if (!note) {
    return res.status(404).json({ error: "Note not found" });
  }

  const block = note.blocks.find((b) => b.id === blockId);

  if (!block) {
    return res.status(404).json({ error: "Block not found" });
  }

  if (!block.content.notes) {
    block.content.notes = [];
  }

  block.content.notes.push({
    time,
    text,
  });

  await updateBlock(noteId, blockId, {
    content: block.content,
  });

  res.json({ success: true });
});
module.exports = router;
