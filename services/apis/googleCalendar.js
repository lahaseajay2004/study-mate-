const { google } = require("googleapis");
const { readJSON } = require("../../utils/fileDB");

const USER_DB = "./database/users.json";

async function getAuthClient(userId) {
  const users = await readJSON(USER_DB);
  const user = users.find((u) => u.userId === userId);

  if (!user?.integrations?.google?.tokens) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI,
  );

  oauth2Client.setCredentials(user.integrations.google.tokens);

  return oauth2Client;
}

async function createCalendarEvent(userId, task) {
  const auth = await getAuthClient(userId);
  if (!auth) return null; // not connected → skip silently

  const calendar = google.calendar({
    version: "v3",
    auth,
  });

  /* ================= DEFAULT LOGIC ================= */

  const startDate = task.dueDate ? new Date(task.dueDate) : new Date(); // today if missing

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1); // +1 day default

  /* ================= EVENT ================= */

  const event = {
    summary: task.title || "Untitled Task",
    description: `Type: ${task.type || "task"}`,
    start: {
      date: startDate.toISOString().split("T")[0], // all-day
    },
    end: {
      date: endDate.toISOString().split("T")[0],
    },
  };

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    return res.data.id; // return event ID
  } catch (err) {
    console.error("Calendar Sync Error:", err.message);
    return null;
  }
}

module.exports = {
  createCalendarEvent,
};
