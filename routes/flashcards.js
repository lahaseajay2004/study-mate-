const express = require("express");
const router = express.Router();

const authGuard = require("../utils/authGuard");
const { getUserId } = require("../utils/userContext");

const {
  createFlashcard,
  getAllFlashcards,
  updateFlashcard,
  deleteFlashcard,
  getFlashcardsBySubject,
  reviewFlashcard,
  getSubjectScore,
  startFlashcardTest,
  submitFlashcardTest,
} = require("../services/flashcard_services");

// =============================
// ALL FLASHCARDS PAGE
// =============================

router.get("/", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);

    const cards = await getAllFlashcards(userId);

    res.render("flashcards_all", {
      cards,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading flashcards");
  }
});

// =============================
// GLOBAL TEST START
// =============================

router.get("/test/all/start", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);

    const cards = await getAllFlashcards(userId);

    if (cards.length === 0) {
      return res.json([]);
    }

    const shuffled = cards.sort(() => Math.random() - 0.5);

    const selected = shuffled.slice(0, 10);

    const mcq = generateMCQ(selected);

    res.json(
      mcq.map((q) => ({
        flashcardId: q.flashcardId,
        question: q.question,
        image: q.image,
        options: q.options,
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start test" });
  }
});

// =============================
// GLOBAL TEST SUBMIT
// =============================

router.post("/test/all/submit", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);

    const cards = await getAllFlashcards(userId);

    const cardMap = {};
    cards.forEach((c) => (cardMap[c.flashcardId] = c));

    let score = 0;
    let result = [];

    for (const flashcardId in req.body.answers) {
      const userAnswer = req.body.answers[flashcardId];
      const card = cardMap[flashcardId];

      if (!card) continue;

      const correct = userAnswer === card.answer;

      if (correct) score++;

      result.push({
        question: card.question,
        correctAnswer: card.answer,
        userAnswer,
        correct,
      });

      await reviewFlashcard(userId, flashcardId, correct ? "good" : "again");
    }

    const total = result.length;
    const percent = total === 0 ? 0 : Math.round((score / total) * 100);

    res.json({
      score,
      total,
      percent,
      result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit test" });
  }
});
// =============================
// TEST ROUTES
// =============================

// start test
router.get("/test/:subjectId/start", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);
    const subjectId = req.params.subjectId;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const questions = await startFlashcardTest(userId, subjectId, 10);

    res.json(questions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start test" });
  }
});

// submit test
router.post("/test/:subjectId/submit", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);
    const subjectId = req.params.subjectId;

    const result = await submitFlashcardTest(
      userId,
      subjectId,
      req.body.answers,
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit test" });
  }
});

// =============================
// FLASHCARD PAGE
// =============================

router.get("/:subjectId", authGuard, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { subjectId } = req.params;

    const cards = await getFlashcardsBySubject(userId, subjectId);
    const score = await getSubjectScore(userId, subjectId);

    res.render("flashcards", {
      cards,
      subjectId,
      score,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading flashcards");
  }
});

// =============================
// CREATE
// =============================

router.post("/create", authGuard, async (req, res) => {
  const userId = getUserId(req);

  const { question, answer, image, subjectId, noteId, blockId } = req.body;

  await createFlashcard({
    userId,
    subjectId,
    noteId,
    sourceBlockId: blockId,
    question,
    answer,
    image,
    createdBy: "user",
  });

  res.redirect("/flashcards/" + subjectId);
});

// =============================
// UPDATE
// =============================

router.post("/:id/update", authGuard, async (req, res) => {
  const { id } = req.params;
  const { question, answer, image, subjectId } = req.body;

  await updateFlashcard(id, {
    question,
    answer,
    image,
  });

  res.redirect("/flashcards/" + subjectId);
});

// =============================
// DELETE
// =============================

router.post("/:id/delete", authGuard, async (req, res) => {
  const { id } = req.params;
  const { subjectId } = req.body;

  await deleteFlashcard(id);

  res.redirect("/flashcards/" + subjectId);
});

// =============================
// REVIEW
// =============================

router.post("/:id/review", authGuard, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  const { rating, subjectId } = req.body;

  await reviewFlashcard(userId, id, rating);

  res.redirect("/flashcards/" + subjectId);
});

module.exports = router;
