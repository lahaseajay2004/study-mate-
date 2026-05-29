const axios = require("axios");

const { readJSON } = require("../../utils/fileDB");
const { interpretAIText, parseAIBlocks } = require("../../utils/aiTextFilter");

const {
  loadShortMemory,
  saveShortMemory,
  loadSummary,
  saveSummary,
  loadVectors,
  saveVectors,
} = require("./aiMemory");

const { getGlobalRules } = require("../../config/aiGlobalRules");
const { searchApis } = require("../apis/apiHub");

const { createTask } = require("../plannerService");
const { createFlashcard } = require("../flashcard_services");

const { searchYouTube } = require("../apis/youtubesearch");

const SUBJECT_DB = "./database/subjects.json";
const PROJECT_DB = "./database/projects.json";

/* ============================
   CONTEXT CONFIG
============================ */

async function getContextConfig(userId, subjectId) {
  const db = await readJSON(SUBJECT_DB, {});

  const userSubjects = db[userId]?.subjects || {};

  return userSubjects[subjectId] || null;
}

/* ============================
   EMBEDDINGS
============================ */

async function embedText(text) {
  const res = await axios.post(
    "https://openrouter.ai/api/v1/embeddings",
    {
      model: "text-embedding-3-small",
      input: text,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  return res.data.data[0].embedding;
}

/* ============================
   VECTOR SIMILARITY
============================ */

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/* ============================
   FILE INPUT BUILDER
============================ */

async function buildUserContent(message, files) {
  if (!files || files.length === 0) {
    return message;
  }

  const content = [{ type: "text", text: message }];

  for (const file of files) {
    if (file.type === "image") {
      content.push({
        type: "image_url",
        image_url: {
          url: file.url,
        },
      });
    }

    if (file.type === "pdf") {
      content.push({
        type: "text",
        text: `PDF CONTENT:\n${file.text}`,
      });
    }
  }

  return content;
}

/* ============================
   MAIN AI FUNCTION
============================ */

async function chatWithAI(payload, files = []) {
  //console.log("AI HIT:", payload);

  const { userId, subjectId, chatId, message } = payload;

  /* LOAD CONTEXT */

  const context = await getContextConfig(userId, subjectId);

  /* LOAD MEMORIES */

  const shortMemory = await loadShortMemory(userId, subjectId, chatId);
  shortMemory.messages = shortMemory.messages || [];

  const summaryMemory = await loadSummary(userId, subjectId, chatId);
  const vectors = await loadVectors(userId, subjectId);

  const messages = [];

  /* GLOBAL RULES */

  messages.push({
    role: "system",
    content: getGlobalRules(),
  });

  /* SUBJECT AI RULES */

  if (context?.aiConfig?.instructions) {
    messages.push({
      role: "system",
      content: context.aiConfig.instructions,
    });
  }

  /* SUMMARY MEMORY */

  if (summaryMemory.summary) {
    messages.push({
      role: "system",
      content: `Conversation summary:\n${summaryMemory.summary}`,
    });
  }

  /* VECTOR MEMORY RECALL */

  if (vectors.length > 0) {
    const queryVector = await embedText(message);

    const scored = vectors.map((v) => ({
      score: cosineSimilarity(queryVector, v.vector),
      text: v.text,
    }));

    scored.sort((a, b) => b.score - a.score);

    const SIM_THRESHOLD = 0.78;

    const filtered = scored.filter((s) => s.score > SIM_THRESHOLD);

    const top = filtered.slice(0, 3);
    

    if (top.length > 0) {
      messages.push({
        role: "system",
        content:
          "Relevant past memory:\n" + top.map((t) => `• ${t.text}`).join("\n"),
      }); 
      console.log("veactor memory match found : \n", + top.map((t) => `• ${t.text}`).join("\n") )
    }
  }

  /* SHORT TERM MEMORY */

  shortMemory.messages.forEach((m) => {
    if (m.role && m.content) messages.push(m);
  });

  /* USER MESSAGE */

  const content = await buildUserContent(message, files);

  messages.push({
    role: "user",
    content,
  });

  //console.log("Prepred Mesage : /n",messages);

  /* ============================
     AI CALL
  ============================ */

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: process.env.OPENROUTER_MODEL,
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "StudyMate",
      },
    },
  );

  const rawReply = response.data.choices[0].message.content || "";

  console.log("============================================================================\n");
  console.log("RAW AI RESPONSE:\n", rawReply);

  /* ============================
     PARSE AI OUTPUT
  ============================ */

  const interpreted = interpretAIText(rawReply) || {
    cleanText: "",
    triggers: [],
  };

  const blocks = parseAIBlocks(interpreted.cleanText);

  /* ============================
     RUN TRIGGERS
  ============================ */

  const triggerResults = await handleTriggers(
    userId,
    subjectId,
    chatId,
    interpreted.triggers || [],
  );

  /* ============================
     UPDATE SHORT MEMORY
  ============================ */

  shortMemory.messages.push({
    role: "user",
    content: message,
  });

  shortMemory.messages.push({
    role: "assistant",
    content: interpreted.cleanText,
  });

  if (shortMemory.messages.length > shortMemory.max) {
    console.log("SHORT MEMORY FULL → GENERATING SUMMARY");

    const newSummary = await generateSummary(shortMemory.messages);

    const existingSummary = await loadSummary(userId, subjectId, chatId);

    const combinedSummary = existingSummary.summary
      ? existingSummary.summary + "\n" + newSummary
      : newSummary;

    await saveSummary(userId, subjectId, chatId, combinedSummary);

    // keep last 2 messages so AI doesn't lose immediate context
    shortMemory.messages = shortMemory.messages.slice(-2);
  }

  await saveShortMemory(userId, subjectId, chatId, shortMemory);

  return {
    text: interpreted.cleanText,
    triggers: interpreted.triggers || [],
    blocks,
    results: triggerResults,
  };
}

/* ============================
   TRIGGER HANDLER
============================ */

async function handleTriggers(userId, subjectId, chatId, triggers) {
  const outputs = [];
  console.log("============================================================================\n");
  console.log("TRIGGERS RECEIVED:", triggers);

  for (const trig of triggers) {
    try {
      console.log("PROCESSING TRIGGER:", trig);

      switch (trig.type) {
        /* FETCH API */

        case "FETCH":
          const apis = {
            wikipedia: trig.source === "wiki",
            wikidata: trig.source === "wikidata",
            openalex: trig.source === "openalex",
            duckduckgo: trig.source === "duckduckgo",
            unsplash: trig.source === "unsplash",
          };

          const apiResults = await searchApis(trig.data, apis);

          let flatResults = [];

          apiResults.forEach((api) => {
            if (!api.error && Array.isArray(api.results)) {
              flatResults.push(
                ...api.results.map((r) => ({
                  title: r.title || r.name || "Untitled",
                  description:
                    r.fulltext || r.snippet || r.extract || "No description",
                  url: r.url || r.link || "#",
                  image: r.image || r.thumbnail || null,
                  source: api.source,
                })),
              );
            }
          });

          console.log("============================================================================\n");
          console.log("Api Results", apiResults);

          outputs.push({
            type: "search",
            query: trig.data,
            results: flatResults.slice(0, 5),
          });

          break;

        /* IMAGE SEARCH */

        case "IMAGE":
          const images = await searchApis(trig.data, {
            unsplash: true,
          });

          let flatImages = [];

          images.forEach((api) => {
            if (!api.error && Array.isArray(api.results)) {
              flatImages.push(...api.results);
            }
          });

          console.log("============================================================================\n");
          console.log("FLAT IMAGES:", flatImages);

          outputs.push({
            type: "images",
            query: trig.data,
            results: flatImages.slice(0, 8),
          });

          break;

        /* FLASHCARD */

        case "FLASHCARD":
          let cardData;

          try {
            cardData = JSON.parse(trig.data);
          } catch {
            const parts = trig.data.split("::");

            cardData = {
              question: parts[0],
              answer: parts[1] || "",
            };
          }

          const flashcard = await createFlashcard({
            userId,
            question: cardData.question,
            answer: cardData.answer,
            subjectId: cardData.subjectId || null,
            createdBy: "ai",
          });

          outputs.push({
            type: "flashcard",
            flashcard,
          });

          break;

        /* TASK CREATION */

        case "CREATE_TASK":
          let taskData;

          try {
            taskData = JSON.parse(trig.data);
          } catch {
            taskData = {
              title: trig.data,
            };
          }

          const task = await createTask(userId, taskData);

          outputs.push({
            type: "task",
            task,
          });

          break;

        /*yt search*/
        case "VIDEO":
          const videos = await searchYouTube(trig.data);

          if (videos.length > 0) {
            outputs.push({
              type: "video",
              source: "youtube",
              query: trig.data,
              results: videos,
            });
          } else {
            outputs.push({
              type: "info",
              text: "No videos found.",
            });
          }

          break;
        /* VECTOR MEMORY */

        case "VECTOR":
          let memoryText = trig.data;
          let memoryType = "fact";

          try {
            const parsed = JSON.parse(trig.data);

            memoryText = parsed.text || trig.data;
            memoryType = parsed.type || "fact";
          } catch {}

          const vector = await embedText(memoryText);

          const vectors = await loadVectors(userId, subjectId);

          vectors.push({
            type: memoryType,
            text: memoryText,
            vector,
            createdAt: Date.now(),
          });

          /* VECTOR LIMIT */

          const MAX_VECTORS = 300;

          if (vectors.length > MAX_VECTORS) {
            vectors.sort((a, b) => a.createdAt - b.createdAt);

            vectors.splice(0, vectors.length - MAX_VECTORS);
          }

          await saveVectors(userId, subjectId, vectors);

          outputs.push({
            type: "vector_saved",
            text: memoryText,
          });

          break;

        /* SUMMARY MEMORY */

        case "SUMMARY":
          await saveSummary(userId, subjectId, chatId, trig.data);

          outputs.push({
            type: "summary_saved",
          });

          break;
      }
    } catch (err) {
      console.error("Trigger failed:", trig, err);
    }
  }

  return outputs;
}

async function generateSummary(messages) {
  const prompt = `
Summarize the following conversation for long term memory.
Keep important facts, goals, and context.

Conversation:
${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}
`;

  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: process.env.OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content: "You compress conversations into useful memory summaries.",
        },
        { role: "user", content: prompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    },
  );

  return res.data.choices[0].message.content;
}

module.exports = { chatWithAI };
