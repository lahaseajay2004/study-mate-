/* =========================
AI NOTES CONTROLLER
========================= */

let aiPopup = null;
let aiCurrentContext = null;
let noteAIChats = {};


async function ensureSubjectAIChat(subjectId, noteId) {
  if (!subjectId || !noteId) return null;

  if (noteAIChats[noteId]) return noteAIChats[noteId];

  const res = await fetch("/chat/" + subjectId);
  const chats = await res.json();

  const existing = chats.find(
    (c) => c.title && c.title.includes(`note_${noteId}`)
  );

  if (existing) {
    noteAIChats[noteId] = existing.chatId;
    return existing.chatId;
  }

  const create = await fetch("/chat/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subjectId,
      title: `Notes AI | note_${noteId}`,
    }),
  });

  const chat = await create.json();

  noteAIChats[noteId] = chat.chatId;

  return chat.chatId;
}

/* =========================
ENSURE SUBJECT AI CHAT
========================= */

async function sendAIChatMessage() {
  const input = document.getElementById("aiChatInput");
  const sendBtn = document.getElementById("aiChatSend");

  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  input.value = "";

  appendAIMessage("user", message);

  // 🔹 ADD THIS (loading message)
  const loadingId = appendLoadingMessage();

  // 🔹 disable input
  sendBtn.disabled = true;

  const chatId = await ensureSubjectAIChat(currentSubjectId, currentNoteId);

  const res = await fetch("/chat/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      subjectId: currentSubjectId,
      chatId,
    }),
  });

  const data = await res.json();

  // 🔹 REMOVE loading
  removeLoadingMessage(loadingId);

  appendAIMessage("ai", data.reply || "");

  sendBtn.disabled = false;

  if (data.results) {
    const resultBox = document.createElement("div");
    renderAIResults(resultBox, data.results);
    document.getElementById("aiMessages").appendChild(resultBox);
  }
}

/* =========================
AI REQUESTS
========================= */

async function runBlockAI({ prompt, content, blockId }) {
  const chatId = await ensureSubjectAIChat(currentSubjectId, currentNoteId);

  const res = await fetch("/chat/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: prompt,
      content,
      subjectId: currentSubjectId,
      chatId,
      blockId,
    }),
  });

  const data = await res.json();

  openAIResultPopup(data, { blockId });
}

async function runAIRequest(payload) {
  console.log("RUN AI REQUEST", payload);
  const chatId = await ensureSubjectAIChat(payload.subjectId, currentNoteId);
  console.log("CHAT ID:", chatId);
  const res = await fetch("/chat/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: payload.prompt,
      content: payload.content,
      subjectId: payload.subjectId,
      chatId,
    }),
  });

  const data = await res.json();

  openAIResultPopup(data, payload);
}

/* =========================
SEND AI CHAT MESSAGE
========================= */

/*async function sendAIChatMessage() {
  const input = document.getElementById("aiChatInput");

  if (!input) return;

  const message = input.value.trim();

  if (!message) return;

  input.value = "";

  appendAIMessage("user", message);

  const chatId = await ensureSubjectAIChat(currentSubjectId, currentNoteId);

  const res = await fetch("/chat/send", {
    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({
      message,
      subjectId: currentSubjectId,
      chatId,
    }),
  });

  const data = await res.json();

  appendAIMessage("ai", data.reply || "");

  if (data.results) {
    const resultBox = document.createElement("div");

    renderAIResults(resultBox, data.results);

    document.getElementById("aiMessages").appendChild(resultBox);
  }
}*/

/* =========================
SELECTION ASK AI
========================= */

document.addEventListener("mouseup", () => {
  const textarea = document.activeElement;

  if (!textarea || textarea.tagName !== "TEXTAREA") return;

  const selection = textarea.value
    .substring(textarea.selectionStart, textarea.selectionEnd)
    .trim();

  if (!selection) return;

  const box = document.createElement("div");

  box.className = "ask-ai-floating";
  box.textContent = "Ask AI";

  box.onclick = () => {
    runAIRequest({
      type: "selection",
      prompt: "Explain this",
      content: selection,
      subjectId: currentSubjectId,
    });

    box.remove();
  };

  document.body.appendChild(box);

  setTimeout(() => box.remove(), 4000);
});

/* =========================
BLOCK AI BUTTON
========================= */

function attachAskAIButton(block) {
  const btn = document.createElement("button");

  btn.className = "ask-ai-btn";
  btn.textContent = "AI";

  btn.onclick = () => {
    const textarea = block.querySelector("textarea");
    if (!textarea) return;

    runBlockAI({
      prompt: "Explain this note",
      content: textarea.value,
      blockId: block.dataset.id,
    });
  };

  block.appendChild(btn);
}

/* =========================
AI POPUP (CHAT VERSION SAFE)
========================= */

function openAIResultPopup(data, context = {}) {
  aiCurrentContext = context;

  if (!aiPopup) {
    aiPopup = document.createElement("div");
    aiPopup.className = "ai-popup";

    aiPopup.innerHTML = `
      <div class="ai-popup-box">

        <div class="ai-popup-header">
          <span>AI Assistant</span>
          <button class="popup-close">✕</button>
        </div>

        <div class="ai-popup-messages" id="aiMessages"></div>

        <div class="ai-popup-input">
          <textarea id="aiChatInput"
          placeholder="Ask AI something..."></textarea>
          <button id="aiChatSend">Send</button>
        </div>

      </div>
    `;

    aiPopup.querySelector(".popup-close").onclick = () => aiPopup.remove();

    aiPopup.querySelector("#aiChatSend").onclick = sendAIChatMessage;

    document.body.appendChild(aiPopup);
  }

  appendAIMessage("ai", data.reply || "");

  if (data.results) {
    const resultBox = document.createElement("div");

    renderAIResults(resultBox, data.results);

    document.getElementById("aiMessages").appendChild(resultBox);
  }

  const actions = renderInsertActions(data);

  document.getElementById("aiMessages").appendChild(actions);
}

/* =========================
INSERT ACTIONS
========================= */

function renderInsertActions(data) {
  const wrap = document.createElement("div");
  wrap.className = "ai-insert-actions";

  const replace = document.createElement("button");
  replace.textContent = "Replace Block";

  replace.onclick = () => {
    if (!aiCurrentContext.blockId) return;

    replaceBlock(aiCurrentContext.blockId, data.reply);
  };

  const add = document.createElement("button");
  add.textContent = "Add Block";

  add.onclick = () => createTextBlock(data.reply);

  wrap.appendChild(replace);
  wrap.appendChild(add);

  return wrap;
}

/* =========================
RESULT RENDERERS
========================= */

function renderAIResults(container, results) {
  results.forEach((block) => {
    let el = null;

    if (block.type === "images") el = renderResultImages(block.results);
    if (block.type === "video") el = renderResultVideos(block.results);
    if (block.type === "task") el = renderResultTask(block.task);

    if (!el) return;

    container.appendChild(el);
  });
}

function renderResultImages(images) {
  const wrapper = document.createElement("div");
  wrapper.className = "image-grid";

  images.slice(0, 4).forEach((img) => {
    const card = document.createElement("div");
    card.className = "image-card";

    card.draggable = true;

    const image = document.createElement("img");
    image.src = img.preview || img.image;

    const add = document.createElement("button");
    add.textContent = "Add to Note";

    add.onclick = () => createImageBlock(img.image);

    card.appendChild(image);
    card.appendChild(add);

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("type", "image");
      e.dataTransfer.setData("url", img.image);
    });

    wrapper.appendChild(card);
  });

  return wrapper;
}

function renderResultVideos(videos) {
  const grid = document.createElement("div");
  grid.className = "video-grid";

  videos.slice(0, 4).forEach((v) => {
    const card = document.createElement("div");
    card.className = "video-card";

    card.draggable = true;

    const thumb = document.createElement("img");
    thumb.src = v.thumbnail;

    const title = document.createElement("div");
    title.textContent = v.title;

    const add = document.createElement("button");
    add.textContent = "Add Video";

    add.onclick = () => createVideoBlock(v);

    card.appendChild(thumb);
    card.appendChild(title);
    card.appendChild(add);

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("type", "video");
      e.dataTransfer.setData("video", JSON.stringify(v));
    });

    grid.appendChild(card);
  });

  return grid;
}

function renderResultTask(task) {
  const card = document.createElement("div");
  card.className = "result-card";

  const title = document.createElement("b");
  title.textContent = task.title;

  const btn = document.createElement("button");
  btn.textContent = "Add Task";

  btn.onclick = () => createTaskBlock(task);

  card.appendChild(title);
  card.appendChild(btn);

  return card;
}

/* =========================
NOTES BLOCK API
========================= */

async function replaceBlock(id, text) {
  await fetch(`/notes/${currentNoteId}/block/${id}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text }),
  });

  loadNote(currentNoteId);
}

async function createTextBlock(text) {
  await fetch(`/notes/${currentNoteId}/block/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "text",
      content: text,
    }),
  });

  loadNote(currentNoteId);
}

async function createImageBlock(url) {
  await fetch(`/notes/${currentNoteId}/block/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "image",
      content: url,
    }),
  });

  loadNote(currentNoteId);
}

async function createVideoBlock(video) {
  const url = video.url || video.link;

  await fetch(`/notes/${currentNoteId}/block/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({
      type: "video",
      content: {
        url: url,
        title: video.title,
        thumbnail: video.thumbnail,
        notes: [],
      },
    }),
  });

  loadNote(currentNoteId);
}

/* =========================
AI TEXT RENDERER
========================= */

function renderAIText(container, text) {
  // draggable wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "ai-text-block";
  wrapper.draggable = true;

  wrapper.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("type", "text");
    e.dataTransfer.setData("text", text);
  });

  container.appendChild(wrapper);

  const lines = text.split("\n");

  let list = null;
  let codeBlock = null;

  lines.forEach((rawLine) => {
    let line = rawLine.trim();

    if (!line) {
      list = null;
      return;
    }

    if (line.startsWith("```")) {
      if (!codeBlock) {
        codeBlock = document.createElement("pre");

        const code = document.createElement("code");

        codeBlock.appendChild(code);

        wrapper.appendChild(codeBlock);
      } else {
        codeBlock = null;
      }

      return;
    }

    if (codeBlock) {
      codeBlock.querySelector("code").textContent += rawLine + "\n";

      return;
    }

    if (line.startsWith("#")) {
      const level = line.match(/^#+/)[0].length;

      const h = document.createElement("h" + Math.min(level, 4));

      h.textContent = line.replace(/^#+\s*/, "");

      wrapper.appendChild(h);

      return;
    }

    if (/^[\-\*]\s+/.test(line)) {
      if (!list) {
        list = document.createElement("ul");

        wrapper.appendChild(list);
      }

      const li = document.createElement("li");

      li.textContent = line.replace(/^[\-\*]\s+/, "");

      list.appendChild(li);

      return;
    }

    if (line.includes("http")) {
      const p = document.createElement("p");

      const urlRegex = /(https?:\/\/[^\s]+)/g;

      p.innerHTML = line.replace(
        urlRegex,
        '<a href="$1" target="_blank">$1</a>',
      );

      wrapper.appendChild(p);

      return;
    }

    const p = document.createElement("p");

    p.textContent = line;

    wrapper.appendChild(p);
  });
}
/* =========================
CHAT MESSAGE RENDER
========================= */

function appendAIMessage(role, text) {
  const container = document.getElementById("aiMessages");

  if (!container) return;

  const msg = document.createElement("div");

  msg.className = "ai-msg " + role;

  const bubble = document.createElement("div");

  bubble.className = "ai-bubble";

  renderAIText(bubble, text);

  msg.appendChild(bubble);

  container.appendChild(msg);

  container.scrollTop = container.scrollHeight;
}

/* =========================
DRAG DROP INTO EDITOR
========================= */

const editor = document.getElementById("blocksContainer");

if (editor) {
  editor.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  editor.addEventListener("drop", (e) => {
    e.preventDefault();

    const type = e.dataTransfer.getData("type");
    console.log("DROP TYPE:", type);
    if (type === "image") {
      const url = e.dataTransfer.getData("url");

      createImageBlock(url);
    }

    if (type === "video") {
      const video = JSON.parse(e.dataTransfer.getData("video"));

      createVideoBlock(video);
    }

    if (type === "text") {
      const text = e.dataTransfer.getData("text");
      createTextBlock(text);
    }
  });
}

function appendLoadingMessage() {
  const container = document.getElementById("aiMessages");

  const msg = document.createElement("div");
  msg.className = "ai-msg ai";

  const bubble = document.createElement("div");
  bubble.className = "ai-bubble loading";

  bubble.innerHTML = `
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  `;

  msg.appendChild(bubble);
  container.appendChild(msg);

  container.scrollTop = container.scrollHeight;

  return msg;
}

function removeLoadingMessage(msg) {
  if (msg) msg.remove();
}
