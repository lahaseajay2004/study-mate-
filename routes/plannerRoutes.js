const express = require("express");
const router = express.Router();

const authGuard = require("../utils/authGuard");
const { getUserId } = require("../utils/userContext");
const { getUserSubjects } = require("../services/subjectService");

const {
  createTask,
  addStep,
  toggleStep,
  getTasks,
  getTaskById,
  deleteTask,
  updateTaskStatus,
  updateTask,
  markHabitDone,
  getAllTasks
} = require("../services/plannerService");


/* ============================================================
   VIEW PLANNER
============================================================ */

router.get("/", authGuard, async (req, res) => {

  const userId = getUserId(req);

  const scope = req.query.scope || "global";
  const subjectId = req.query.subjectId || null;

  let tasks;

if(scope === "all"){
tasks = await getAllTasks(userId);
}else{
tasks = await getTasks(userId, scope, subjectId);
}

  const subjectsObj = await getUserSubjects(userId);
  const subjects = Object.values(subjectsObj || {});

  res.render("planner", {
    tasks,
    scope,
    subjectId,
    subjects
  });

});


/* ============================================================
   CREATE TASK
============================================================ */

router.post("/create", authGuard, async (req, res) => {

  try {

    const userId = getUserId(req);

    let {
      title,
      type,
      scope,
      subjectId,
      steps
    } = req.body;

    let parsedSteps = [];

    if (Array.isArray(steps)) {
      parsedSteps = steps.map(s => ({
         title: typeof s === "string" ? s : s.title
        }));
      }

    await createTask(userId, {
      title,
      type,
      scope,
      subjectId,
      steps: parsedSteps
    });

    res.redirect("back");

  } catch (err) {

    console.error("Create task error:", err);
    res.status(500).send("Task creation failed");

  }

});


/* ============================================================
   UPDATE TASK (EDITOR PANEL)
============================================================ */

router.post("/update/:taskId", authGuard, async (req, res) => {

  const userId = getUserId(req);
  const { taskId } = req.params;

  const {
    title,
    status,
    priority,
    dueDate,
    scope,
    subjectId
  } = req.body;

  await updateTask(userId, scope || "global", taskId, {
    title,
    status,
    priority,
    dueDate
  }, subjectId || null);

  res.json({ success: true });

});


/* ============================================================
   DRAG DROP STATUS UPDATE
============================================================ */

router.post("/update-status", authGuard, async (req, res) => {

  const userId = getUserId(req);

  const {
    taskId,
    status,
    scope,
    subjectId
  } = req.body;

  await updateTaskStatus(
    userId,
    scope || "global",
    taskId,
    status,
    subjectId || null
  );

  res.json({ success: true });

});


/* ============================================================
   ADD STEP
============================================================ */

router.post("/add-step/:taskId", authGuard, async (req, res) => {

  const userId = getUserId(req);
  const { taskId } = req.params;

  const {
    title,
    weight,
    scope,
    subjectId
  } = req.body;

  await addStep(
    userId,
    scope || "global",
    taskId,
    { title, weight },
    subjectId || null
  );

  res.json({ success: true });

});


/* ============================================================
   TOGGLE STEP
============================================================ */

router.post("/toggle-step/:taskId/:stepId", authGuard, async (req, res) => {

  const userId = getUserId(req);

  const { taskId, stepId } = req.params;
  const { scope, subjectId } = req.query;

  await toggleStep(
    userId,
    scope || "global",
    taskId,
    stepId,
    subjectId || null
  );

  res.json({ success: true });

});


/* ============================================================
   GET SINGLE TASK (EDITOR LOAD)
============================================================ */

router.get("/task/:taskId", authGuard, async (req, res) => {

  const userId = getUserId(req);

  const { taskId } = req.params;
  const { scope, subjectId } = req.query;

  const task = await getTaskById(
    userId,
    scope || "global",
    taskId,
    subjectId || null
  );

  res.json(task);

});


/* ============================================================
   HABIT DONE
============================================================ */

router.post("/habit-done/:taskId", authGuard, async (req, res) => {

  const userId = getUserId(req);
  const { taskId } = req.params;

  await markHabitDone(userId, taskId);

  res.json({ success: true });

});


/* ============================================================
   DELETE TASK
============================================================ */

router.post("/delete/:taskId", authGuard, async (req, res) => {

  const userId = getUserId(req);

  const { taskId } = req.params;
  const { scope, subjectId } = req.query;

  await deleteTask(
    userId,
    scope || "global",
    taskId,
    subjectId || null
  );

  res.json({ success: true });

});


module.exports = router;