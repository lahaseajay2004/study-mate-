const fs = require("fs/promises");
const path = require("path");

const FLASHCARD_DB = path.join(__dirname, "../database/flashcards.json");
const PROGRESS_DB = path.join(__dirname, "../database/flashcardProgress.json");

async function readJSON(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return [];
  }
}

async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

function generateId(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

//--------------------------create 

async function createFlashcard(data) {
  const flashcards = await readJSON(FLASHCARD_DB);

  const newCard = {
    flashcardId: generateId("fc"),
    userId: data.userId,
    subjectId: data.subjectId || null,
    noteId: data.noteId || null,
    sourceBlockId: data.sourceBlockId || null,
    question: data.question,
    answer: data.answer,
    image: data.image || null,
    createdBy: data.createdBy || "user",
    createdAt: new Date().toISOString()
  };

  flashcards.push(newCard);
  await writeJSON(FLASHCARD_DB, flashcards);

  return newCard;
}
//---------------------------update and delete

async function deleteFlashcard(flashcardId) {
  const flashcards = await readJSON(FLASHCARD_DB);
  const progress = await readJSON(PROGRESS_DB);

  const filteredCards = flashcards.filter(c => c.flashcardId !== flashcardId);
  const filteredProgress = progress.filter(p => p.flashcardId !== flashcardId);

  await writeJSON(FLASHCARD_DB, filteredCards);
  await writeJSON(PROGRESS_DB, filteredProgress);

  return true;
}

async function updateFlashcard(flashcardId, data) {
  const flashcards = await readJSON(FLASHCARD_DB);

  const card = flashcards.find(c => c.flashcardId === flashcardId);
  if (!card) return null;

  if (data.question !== undefined) card.question = data.question;
  if (data.answer !== undefined) card.answer = data.answer;
  if (data.image !== undefined) card.image = data.image;

  await writeJSON(FLASHCARD_DB, flashcards);

  return card;
}

//-------------------------block to flash

async function blockToFlashcard(userId, noteId, subjectId, block) {

  if (!block || !block.content) return null;

  const question = "Explain:";
  const answer = typeof block.content === "string"
    ? block.content
    : JSON.stringify(block.content);

  return createFlashcard({
    userId,
    subjectId,
    noteId,
    sourceBlockId: block.id,
    question,
    answer,
    createdBy: "user"
  });
}

//-------------------------------test and scoring-

async function reviewFlashcard(userId, flashcardId, rating) {

  const progress = await readJSON(PROGRESS_DB);

  let record = progress.find(
    p => p.userId === userId && p.flashcardId === flashcardId
  );

  if (!record) {
    record = {
      userId,
      flashcardId,
      score: 50,
      attempts: 0,
      correct: 0,
      wrong: 0,
      lastReview: null,
      nextReview: null
    };

    progress.push(record);
  }

  record.attempts++;

  if (rating === "again") {
    record.score -= 15;
    record.wrong++;
  }

  if (rating === "hard") {
    record.score -= 5;
  }

  if (rating === "good") {
    record.score += 10;
    record.correct++;
  }

  if (rating === "easy") {
    record.score += 20;
    record.correct++;
  }

  if (record.score < 0) record.score = 0;
  if (record.score > 100) record.score = 100;

  record.lastReview = new Date().toISOString();

  const days = Math.max(1, Math.floor(record.score / 20));
  const next = new Date();
  next.setDate(next.getDate() + days);

  record.nextReview = next.toISOString();

  await writeJSON(PROGRESS_DB, progress);

  return record;
}
//--------------------------test system

function shuffle(arr) {

  for (let i = arr.length - 1; i > 0; i--) {

    const j = Math.floor(Math.random() * (i + 1));

    [arr[i], arr[j]] = [arr[j], arr[i]];

  }

  return arr;
}

function generateMCQ(cards){

const fillerOptions = [
"None of the above",
"All of the above",
"Not related",
"Unknown",
"Incorrect",
"Alternative answer"
]

return cards.map(card=>{

let options=[card.answer]

let attempts=0

while(options.length<4 && attempts<20){

const random=cards[Math.floor(Math.random()*cards.length)]

if(
random.answer!==card.answer &&
!options.includes(random.answer)
){
options.push(random.answer)
}

attempts++

}

while(options.length<4){

const filler=fillerOptions[
Math.floor(Math.random()*fillerOptions.length)
]

if(!options.includes(filler)){
options.push(filler)
}

}

options=shuffle(options)

return{
flashcardId:card.flashcardId,
question:card.question,
image:card.image,
options,
correctAnswer:card.answer
}

})

}

//--------------------------start test

async function startFlashcardTest(userId, subjectId, count = 10) {

  const cards = await getFlashcardsBySubject(userId, subjectId);

  if (cards.length === 0) return [];

  const shuffled = shuffle(cards);

  const selected = shuffled.slice(0, count);

  const mcq = generateMCQ(selected);

  return mcq.map(q => ({
    flashcardId: q.flashcardId,
    question: q.question,
    image: q.image,
    options: q.options
  }));

}

//--------------------------submit test

async function submitFlashcardTest(userId, subjectId, answers) {

  const cards = await getFlashcardsBySubject(userId, subjectId);

  const cardMap = {};
  cards.forEach(c => cardMap[c.flashcardId] = c);

  let score = 0;
  const result = [];

  for (const flashcardId in answers) {

    const userAnswer = answers[flashcardId];
    const card = cardMap[flashcardId];

    if (!card) continue;

    const correct = userAnswer === card.answer;

    if (correct) score++;

    result.push({
      question: card.question,
      correctAnswer: card.answer,
      userAnswer,
      correct
    });

    // update spaced repetition score
    await reviewFlashcard(
      userId,
      flashcardId,
      correct ? "good" : "again"
    );

  }

  const total = result.length;
  const percent = total === 0 ? 0 : Math.round((score / total) * 100);

  return {
    score,
    total,
    percent,
    result
  };

}

//--------------------------get
async function getFlashcardsBySubject(userId, subjectId) {
  const flashcards = await readJSON(FLASHCARD_DB);

  return flashcards.filter(c =>
    c.userId === userId && c.subjectId === subjectId
  );
}

async function getWeakFlashcards(userId) {
  const progress = await readJSON(PROGRESS_DB);

  return progress.filter(p =>
    p.userId === userId && p.score < 40
  );
}

async function getDueFlashcards(userId) {

  const progress = await readJSON(PROGRESS_DB);
  const flashcards = await readJSON(FLASHCARD_DB);

  const now = new Date();

  const dueIds = progress
    .filter(p =>
      p.userId === userId &&
      p.nextReview &&
      new Date(p.nextReview) <= now
    )
    .map(p => p.flashcardId);

  return flashcards.filter(c => dueIds.includes(c.flashcardId));
}

async function getSubjectScore(userId, subjectId) {

  const flashcards = await readJSON(FLASHCARD_DB);
  const progress = await readJSON(PROGRESS_DB);

  const subjectCards = flashcards.filter(
    c => c.userId === userId && c.subjectId === subjectId
  );

  if (subjectCards.length === 0) {
    return { subjectId, averageScore: 0, cardCount: 0 };
  }

  const scores = subjectCards.map(card => {

    const p = progress.find(
      r => r.userId === userId && r.flashcardId === card.flashcardId
    );

    return p ? p.score : 50;
  });

  const avg =
    scores.reduce((sum, s) => sum + s, 0) / scores.length;

  return {
    subjectId,
    averageScore: Math.round(avg),
    cardCount: scores.length
  };
}
//--------------------------get all flashcards

async function getAllFlashcards(userId) {

  const flashcards = await readJSON(FLASHCARD_DB);

  return flashcards.filter(c => c.userId === userId);

}



module.exports = {
  getAllFlashcards,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
  getFlashcardsBySubject,
  blockToFlashcard,
  reviewFlashcard,
  getWeakFlashcards,
  getDueFlashcards,
  getSubjectScore,
  startFlashcardTest,
  generateMCQ,
  submitFlashcardTest
  
};



