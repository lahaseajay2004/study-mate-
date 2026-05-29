const express = require("express");
const session = require("express-session");
const path = require("path");

require("dotenv").config();

const app = express();
const PORT = 3000;

const dashboard = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");
const profileRoutes = require("./routes/profile");
const subjectRoutes = require("./routes/subjectRoutes");
//const projectRoutes = require("./routes/projectRoutes");
const authRoutes = require("./routes/authRoutes");
const contextRoutes = require("./routes/contextRoutes");
const plannerRoutes = require("./routes/plannerRoutes");
const aiRoutes = require("./routes/aiRoutes");
const notesRoutes = require("./routes/notesRoutes");
const apiRoutes = require("./routes/apiTestRoutes");
const flashcard = require("./routes/flashcards");

//utlites
const authGuard = require("./utils/authGuard");

//Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "studymate-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // ✅ 7 days
      httpOnly: true,
    },
  }),
);
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

//Routes
app.use("/dashboard", dashboard);
app.use("/users", userRoutes);
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/subjects", subjectRoutes);
//app.use("/projects", projectRoutes);
app.use("/context", contextRoutes);
app.use("/planner", plannerRoutes);
app.use("/chat", aiRoutes);
app.use("/notes", notesRoutes);
app.use("/api-test", apiRoutes);
app.use("/flashcards", flashcard);

//uploaded images
app.use("/uploads", express.static(path.join(__dirname, "database/uploads")));

//View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//HOMERoute
app.get("/", authGuard, (req, res) => {
  res.redirect("/dashboard/");
});

//Port
app.use((req, res, next) => {
  console.log(
    `📥 ${req.method} ${req.url} | ${new Date().toLocaleTimeString()}`,
  );
  next();
});

const os = require("os");

app.listen(PORT, () => {
  console.clear();

  console.log("StudyMate Server ONLINE");

  console.log(`URL        : http://localhost:${PORT}`);
  console.log(`Started At : ${new Date().toLocaleString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  console.log("\nSystem Info:");
  console.log(`Platform   : ${os.platform()}`);
  console.log(`CPU Cores  : ${os.cpus().length}`);
  console.log(`Free Memory: ${(os.freemem() / 1024 / 1024).toFixed(2)} MB`);

  console.log("\nApp Info:");
  console.log(`PID        : ${process.pid}`);

});

//१६५९
