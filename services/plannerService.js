const { readJSON, writeJSON } = require("../utils/fileDB");

const DB_PATH = "./database/planner.json";
const { createCalendarEvent } = require("./apis/googleCalendar.js");

/* ============================================================
   Helpers
============================================================ */

function generateId(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

async function loadDB() {
  const db = await readJSON(DB_PATH);
  if (!db.users) db.users = {};
  return db;
}

async function saveDB(db) {
  await writeJSON(DB_PATH, db);
}

function ensureUserStructure(db, userId) {
  if (!db.users[userId]) {
    db.users[userId] = {
      global: { tasks: {} },
      subjects: {},
    };
  }
}

function ensureSubject(db, userId, subjectId) {
  if (!db.users[userId].subjects[subjectId]) {
    db.users[userId].subjects[subjectId] = {
      tasks: {},
    };
  }
}

function calculateTaskProgress(task) {
  const steps = Object.values(task.steps || {});
  if (!steps.length) return 0;

  const totalWeight = steps.reduce((a, s) => a + (s.weight || 1), 0);
  const completedWeight = steps
    .filter((s) => s.status === "completed")
    .reduce((a, s) => a + (s.weight || 1), 0);

  return Math.round((completedWeight / totalWeight) * 100);
}

/* ============================================================
   Create Task
============================================================ */

async function createTask(userId, data) {
  const db = await loadDB();
  ensureUserStructure(db, userId);

  console.log("CREATE TASK DATA:", data);

  const scope = data.scope || "global";
  const taskId = generateId("task");

  const task = {
    taskId,
    title: data.title,
    type: data.type || "task", // task | todo | habit
    status: data.status || "todo", // todo | in-progress | completed
    scope,
    subjectId: data.subjectId || null,
    progress: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,

    steps: {},
    stepOrder: [],

    habitDays: {},
  };

  /* ADD STEPS */

  if (Array.isArray(data.steps)) {
    data.steps.forEach((step, index) => {
      const stepId = generateId("step");

      const stepData = {
        stepId,
        title: step.title || "Untitled step",
        status: step.status || "pending", // pending | done
        weight: step.weight || 1,
        order: index,
      };

      task.steps[stepId] = stepData;
      task.stepOrder.push(stepId);
    });
  }

  /* SAVE TASK */

  if (scope === "subject") {
    if (!data.subjectId)
      throw new Error("subjectId required for subject scope");

    ensureSubject(db, userId, data.subjectId);

    db.users[userId].subjects[data.subjectId].tasks[taskId] = task;
  } else {
    db.users[userId].global.tasks[taskId] = task;
  }

  await saveDB(db);

  /* ================= GOOGLE SYNC ================= */

  try {
    const eventId = await createCalendarEvent(userId, task);

    if (eventId) {
      task.googleEventId = eventId;
      await saveDB(db); // save again with event ID
    }
  } catch (err) {
    console.error("Sync failed:", err.message);
  }

  return task;
}

/* ============================================================
   Add Step
============================================================ */

async function addStep(userId, scope, taskId, stepData, subjectId = null) {
  const db = await loadDB();
  const user = db.users[userId];
  if (!user) return null;

  let task;

  if (scope === "subject") {
    task = user.subjects?.[subjectId]?.tasks?.[taskId];
  } else {
    task = user.global.tasks?.[taskId];
  }

  if (!task) return null;

  const stepId = generateId("step");

  task.steps[stepId] = {
    stepId,
    title: stepData.title,
    status: "pending",
    weight: stepData.weight || 1,
  };

  task.progress = calculateTaskProgress(task);

  await saveDB(db);
  return task;
}

/* ============================================================
   Toggle Step
============================================================ */

async function toggleStep(userId, scope, taskId, stepId, subjectId = null) {
  const db = await loadDB();
  const user = db.users[userId];
  if (!user) return null;

  let task;

  if (scope === "subject") {
    task = user.subjects?.[subjectId]?.tasks?.[taskId];
  } else {
    task = user.global.tasks?.[taskId];
  }

  if (!task) return null;

  const step = task.steps?.[stepId];
  if (!step) return null;

  step.status = step.status === "completed" ? "pending" : "completed";

  task.progress = calculateTaskProgress(task);

  if (task.progress === 100) {
    task.status = "completed";
    task.completedAt = new Date().toISOString();
  } else {
    task.status = "progress";
    task.completedAt = null;
  }

  await saveDB(db);
  return task;
}

/* ============================================================
   Get Tasks
============================================================ */

async function getTasks(userId, scope = "global", subjectId = null) {
  const db = await loadDB();
  const user = db.users[userId];
  if (!user) return [];

  if (scope === "subject") {
    return Object.values(user.subjects?.[subjectId]?.tasks || {});
  }

  return Object.values(user.global.tasks || {});
}

async function getAllTasks(userId) {
  const db = await loadDB();
  const user = db.users[userId];

  if (!user) return [];

  const globalTasks = Object.values(user.global?.tasks || {});

  const subjectTasks = Object.values(user.subjects || {}).flatMap((subject) =>
    Object.values(subject.tasks || {}),
  );

  return [...globalTasks, ...subjectTasks];
}

async function getTaskById(userId, scope, taskId, subjectId = null) {
  const db = await loadDB();
  const user = db.users[userId];
  if (!user) return null;

  if (scope === "subject") {
    return user.subjects?.[subjectId]?.tasks?.[taskId] || null;
  }

  return user.global.tasks?.[taskId] || null;
}

/* ============================================================
   Delete Task
============================================================ */

async function deleteTask(userId, scope, taskId, subjectId = null) {
  const db = await loadDB();
  const user = db.users[userId];
  if (!user) return false;

  if (scope === "subject") {
    delete user.subjects?.[subjectId]?.tasks?.[taskId];
  } else {
    delete user.global.tasks?.[taskId];
  }

  await saveDB(db);
  return true;
}

/* ============================================================
   Analytics (Graph Ready)
============================================================ */

async function getTaskStats(userId) {
  const db = await loadDB();
  const user = db.users[userId];
  if (!user) return {};

  const globalTasks = Object.values(user.global.tasks || {});
  const subjectTasks = Object.values(user.subjects || {}).flatMap((s) =>
    Object.values(s.tasks || {}),
  );

  const all = [...globalTasks, ...subjectTasks];

  return {
    total: all.length,
    completed: all.filter((t) => t.status === "completed").length,
    active: all.filter((t) => t.status === "active").length,
    byType: all.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {}),
  };
}

async function updateTask(userId, scope, taskId, data, subjectId = null) {
  const db = await loadDB();
  const user = db.users[userId];
  if (!user) return null;

  let task;

  if (scope === "subject") {
    task = user.subjects?.[subjectId]?.tasks?.[taskId];
  } else {
    task = user.global.tasks?.[taskId];
  }

  if (!task) return null;

  if (data.title !== undefined) task.title = data.title;
  if (data.status !== undefined) task.status = data.status;
  if (data.priority !== undefined) task.priority = data.priority;
  if (data.dueDate !== undefined) task.dueDate = data.dueDate;

  await saveDB(db);

  return task;
}

async function updateTaskStatus(
  userId,
  scope,
  taskId,
  status,
  subjectId = null,
) {
  const db = await loadDB();
  const user = db.users[userId];
  if (!user) return null;

  let task;

  if (scope === "subject") {
    task = user.subjects?.[subjectId]?.tasks?.[taskId];
  } else {
    task = user.global.tasks?.[taskId];
  }

  if (!task) return null;

  task.status = status;

  if (status === "completed") {
    task.completedAt = new Date().toISOString();
  } else {
    task.completedAt = null;
  }

  await saveDB(db);

  return task;
}

async function markHabitDone(userId, taskId) {
  const db = await loadDB();
  const user = db.users[userId];
  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];

  const allTasks = [
    ...Object.values(user.global.tasks || {}),
    ...Object.values(user.subjects || {}).flatMap((s) =>
      Object.values(s.tasks || {}),
    ),
  ];

  const habit = allTasks.find((t) => t.taskId === taskId);

  if (!habit || habit.type !== "habit") return null;

  if (!habit.habitDays) habit.habitDays = {};

  habit.habitDays[today] = true;

  await saveDB(db);

  return habit;
}

/* ============================================================
   Export
============================================================ */

module.exports = {
  createTask,
  addStep,
  toggleStep,
  getTasks,
  deleteTask,
  getTaskStats,
  getAllTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  markHabitDone,
};
