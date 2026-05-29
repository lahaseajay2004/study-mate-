/* ========== RESTORED ALL FUNCTIONS ========== */
let currentSubjectId = null;
let currentNoteId = null;

// ⭐ add this
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

function openCreateModal(subjectId) {
  document.getElementById("modalSubjectId").value = subjectId;
  document.getElementById("createModal").style.display = "flex";
}

function openImageModal() {
  const modal = document.getElementById("imageModal");
  modal.style.display = "flex";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

async function loadNote(noteId) {
  currentNoteId = noteId;

  const res = await fetch(`/notes/${noteId}`);
  const data = await res.json();

  window.noteTasks = data.tasks || [];
  const note = data.note;

  document.getElementById("noteTitle").innerText = note.title;
  currentSubjectId = data.note.subjectId;
  console.log("curent subjec id :", currentSubjectId);

  const container = document.getElementById("blocksContainer");
  container.innerHTML = "";

  note.blocks.forEach((block) => renderBlock(block));
  enableDragAndDrop();
}

function renderBlock(block) {
  // new variable
  const container = document.getElementById("blocksContainer");
  const div = document.createElement("div");
  div.className = "block";
  div.dataset.id = block.id;
  div.dataset.type = block.type;

  //------------------------text
  if (block.type === "text") {
    div.innerHTML = `
  <button class="block-delete" onclick="deleteBlock('${block.id}')">✕</button>
  <textarea 
    oninput="autoResize(this)" 
    onkeyup="detectBlockCommands(this,event)">
    ${block.content || ""}
  </textarea>
`;
  }
  //-----------------------image
  if (block.type === "image") {
    div.innerHTML = `  
   <button class="block-delete" onclick="deleteBlock('${block.id}')">✕</button> 
   <div class="image-wrapper"> 
   <img src="${block.content}" class="note-image"> 
   <button class="image-toggle" onclick="toggleImage(this)">⤢</button> </div> `;
  }
  //-------------------api

  if (block.type === "api") {
    div.innerHTML = `
    <button class="block-delete" onclick="deleteBlock('${block.id}')">✕</button>
      ${block.content.image ? `<img src="${block.content.image}">` : ""}
      <h4>${block.content.title}</h4>
      <textarea oninput="autoResize(this)">${block.content.fullText || block.content.preview || ""}</textarea>
    `;
  }

  //------------------task

  if (block.type === "task") {
    div.innerHTML = `
    <div class="task-block">
      <div class="task-header">
        <h4>Tasks</h4>
        <button class="block-delete" onclick="deleteBlock('${block.id}')">✕</button>
      </div>
      <div class="task-cards-container" id="taskCards_${block.id}"></div>
      <input type="text" class="task-input" placeholder="Add a new task" 
             onkeydown="addTaskToBlock(event,'${block.id}')">
    </div>
  `;

    const taskContainer = div.querySelector(`#taskCards_${block.id}`);
    const tasksInBlock = block.meta?.tasks || [];

    tasksInBlock.forEach((taskId) => {
      const task = window.noteTasks.find((t) => t.taskId === taskId);
      if (!task) return;

      const taskCard = document.createElement("div");
      taskCard.className = "task-card";
      if (task.status === "completed") taskCard.classList.add("completed");

      taskCard.dataset.taskId = task.taskId;
      taskCard.dataset.scope = block.meta.scope || "global";
      taskCard.dataset.subjectId = block.meta.subjectId || "";

      taskCard.innerHTML = `
      <label class="task-label">
        <input type="checkbox" ${task.status === "completed" ? "checked" : ""}>
        <span class="task-title">${task.title}</span>
      </label>
      <div class="task-footer">
        <button class="task-delete" onclick="deleteTaskFromBlock('${task.taskId}','${block.id}')">✕</button>
      </div>
    `;
      taskContainer.appendChild(taskCard);
    });
  }

  //---------------------------------white board
  if (block.type === "whiteboard") {
    div.innerHTML = `
    <button class="block-delete" onclick="deleteBlock('${block.id}')">✕</button>
    <div class="whiteboard-container">
    <div class="wb-toolbar">
    <button onclick="setSelect('${block.id}')" setActiveButton('${block.id}','select')">Select</button>
    <button onclick="enableDraw('${block.id}')" setActiveButton('${block.id}','draw')">Draw</button>
    <button onclick="addRect('${block.id}')" setActiveButton('${block.id}','rect')">Rect</button>
    <button onclick="addCircle('${block.id}')" setActiveButton('${block.id}','circle')">Circle</button>
    <button onclick="addText('${block.id}')" setActiveButton('${block.id}','text')">Text</button>
    <button onclick="deleteSelected('${block.id}')" setActiveButton('${block.id}','delete')">Delete</button>

    <select onchange="resizeCanvas('${block.id}', this.value)">
        <option value="small">Small</option>
        <option value="medium" selected>Medium</option>
        <option value="large">Large</option>
    </select>
      <input type="color" id="color_${block.id}" 
         value="#000000"
         onchange="changeColor('${block.id}', this.value)">


    <button onclick="increaseHeight('${block.id}')">+ Height</button>
    <button onclick="saveWhiteboard('${block.id}')">Save</button>
    </div>

    <canvas id="canvas_${block.id}" width="700" height="400"></canvas>
    </div>
  `;

    setTimeout(() => {
      initWhiteboard(block);
    }, 0);
  }
  // ---------------- VIDEO BLOCK ----------------
  if (block.type === "video") {
    const v = block.content || {};
    const notes = v.notes || [];

    const timestamps = notes
      .map(
        (n) => `
    <div class="video-note"
      onclick="playVideo('${v.url}',${n.time},'${block.id}')">
      ⏱ ${formatTime(n.time)} – ${n.text}
    </div>
  `,
      )
      .join("");

    div.innerHTML = `
    <button class="block-delete" onclick="deleteBlock('${block.id}')">✕</button>

    <div class="video-block">

      ${
        v.thumbnail
          ? `<img src="${v.thumbnail}" class="video-thumb"
      onclick="playVideo('${v.url}',0,'${block.id}')">`
          : ""
      }

      <div class="video-info">

        <h4>${v.title || "Video"}</h4>

        <button onclick="playVideo('${v.url}',0,'${block.id}')">
          ▶ Play
        </button>

      </div>

    </div>
  `;
  }
  // ---------------- TABLE BLOCK ----------------
  if (block.type === "table") {
    const { rows, cols, data } = block.content;

    let html = `
    <button class="block-delete" onclick="deleteBlock('${block.id}')">✕</button>
    <div class="table-wrapper">
      <table class="note-table">
  `;

    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += `
        <td>
          <input type="text"
            value="${data[r][c] || ""}"
            oninput="updateTableCell('${block.id}', ${r}, ${c}, this.value)">
        </td>
      `;
      }
      html += "</tr>";
    }

    html += `
      </table>

      <div class="table-controls">
        <button onclick="addTableRow('${block.id}')">+ Row</button>
        <button onclick="addTableColumn('${block.id}')">+ Column</button>
      </div>
    </div>
  `;

    div.innerHTML = html;
  }
  div.dataset.id = block.id;
  div.dataset.type = block.type;
  div.dataset.subjectId = block.subjectId || "";
  // ---- ADD DRAG BAR ----
  const dragBar = document.createElement("div");
  dragBar.className = "drag-bar";
  dragBar.innerHTML = `<span class="drag-icon">⋮⋮</span>`;
  div.appendChild(dragBar);
  container.appendChild(div);
  setTimeout(() => {
    const textareas = div.querySelectorAll("textarea");
    attachAskAIButton(div);
    textareas.forEach((t) => autoResize(t));
  }, 0);
}

function initImageResize(img, blockId) {
  const wrapper = img.parentElement;
  const handle = wrapper.querySelector(".resize-handle");

  let isResizing = false;

  handle.addEventListener("mousedown", () => {
    isResizing = true;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const rect = wrapper.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;

    wrapper.style.width = newWidth + "px";
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;

      // Save width to backend
      const width = wrapper.offsetWidth;

      fetch(`/notes/${currentNoteId}/block/${blockId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta: { width },
        }),
      });
    }
  });
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

async function addTextBlock() {
  await fetch(`/notes/${currentNoteId}/block/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "text", content: "" }),
  });
  loadNote(currentNoteId);
}

async function saveWholeNote() {
  const blocks = document.querySelectorAll(".block");

  for (const block of blocks) {
    if (block.dataset.type === "text" || block.dataset.type === "api") {
      const content = block.querySelector("textarea").value;

      await fetch(`/notes/${currentNoteId}/block/${block.dataset.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    }
  }

  alert("Saved");
}

async function saveBlock(block) {
  if (!block) return;

  if (block.dataset.type === "text" || block.dataset.type === "api") {
    const textarea = block.querySelector("textarea");
    if (!textarea) return;

    const content = textarea.value;

    await fetch(`/notes/${currentNoteId}/block/${block.dataset.id}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }
}

async function uploadImage() {
  const fileInput = document.getElementById("imageInput");
  const formData = new FormData();
  formData.append("image", fileInput.files[0]);

  await fetch(`/notes/${currentNoteId}/upload-image`, {
    method: "POST",
    body: formData,
  });

  closeModal("imageModal");
  loadNote(currentNoteId);
}

/* ===== API SEARCH RESTORED ===== */

async function searchApis() {
  const query = document.getElementById("commandInput").value;

  const res = await fetch("/notes/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      selectedApis: {
        wikipedia: true,
        wikidata: true,
        openalex: true,
        duckduckgo: true,
      },
    }),
  });

  const data = await res.json();
  showApiResults(data.sources);
}

function showApiResults(sources) {
  const container = document.getElementById("apiResults");
  container.innerHTML = "";

  let hasResults = false;

  sources.forEach((source) => {
    source.results.forEach((result) => {
      hasResults = true;

      const card = document.createElement("div");
      card.className = "api-card";

      card.innerHTML = `
        ${result.image ? `<img src="${result.image}" style="max-width:100%;">` : ""}
        <h4>${result.title}</h4>
        <p>${result.preview}</p>
        <button onclick='addApiBlock("${result.id}")'>Add</button>
      `;

      card.dataset.result = JSON.stringify(result);
      container.appendChild(card);
    });
  });

  if (!hasResults) {
    container.innerHTML = "<p>No results found.</p>";
  }

  document.getElementById("apiModal").style.display = "flex";
}

async function addApiBlock(resultId) {
  const cards = document.querySelectorAll(".api-card");
  let selected = null;

  cards.forEach((card) => {
    const data = JSON.parse(card.dataset.result);
    if (data.id === resultId) selected = data;
  });

  await fetch(`/notes/${currentNoteId}/block/add-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockData: selected }),
  });

  closeModal("apiModal");
  loadNote(currentNoteId);
}

function toggleImage(btn) {
  const img = btn.parentElement.querySelector("img");

  if (img.style.display === "none") {
    img.style.display = "block";
    btn.innerText = "Minimize";
  } else {
    img.style.display = "none";
    btn.innerText = "Show Image";
  }
}

async function handleApiCommand(command, query) {
  showApiLoading(); // 🔥 open modal immediately

  try {
    const res = await fetch("/notes/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        selectedApis: {
          wikipedia: command === "wiki" || command === "search",
          wikidata: command === "search",
          openalex: command === "search",
          duckduckgo: command === "search",
        },
      }),
    });

    const data = await res.json();

    showApiResults(data.sources);
  } catch (err) {
    const container = document.getElementById("apiResults");
    container.innerHTML = `<p style="color:red;">Search failed.</p>`;
  }
}

async function runApiSearch(query, selectedApis) {
  const res = await fetch("/notes/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      selectedApis,
    }),
  });

  const data = await res.json();

  if (!data.success) {
    return alert("Search failed");
  }

  showApiResults(data.sources);
}

async function deleteBlock(blockId) {
  await fetch(`/notes/${currentNoteId}/block/${blockId}/delete`, {
    method: "POST",
  });
  loadNote(currentNoteId);
}
async function deleteNote(noteId) {
  if (!confirm("Delete this note?")) return;

  await fetch(`/notes/${noteId}/delete`, {
    method: "POST",
  });

  location.reload();
}

function showApiLoading() {
  const modal = document.getElementById("apiModal");
  const container = document.getElementById("apiResults");

  container.innerHTML = `
    <div class="api-loading">
      <div class="spinner"></div>
      <p>Searching...</p>
    </div>
  `;

  modal.style.display = "flex";
}

//--------------------------tasks
document.addEventListener("change", async function (e) {
  if (e.target.closest(".task-card") && e.target.type === "checkbox") {
    const card = e.target.closest(".task-card");

    const taskId = card.dataset.taskId;
    const scope = card.dataset.scope;
    const subjectId = card.dataset.subjectId || null;

    await fetch(`/notes/task/${taskId}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, subjectId }),
    });

    card.classList.toggle("completed");
  }
});

async function addTaskToBlock(e, blockId) {
  if (e.key !== "Enter") return;
  const input = e.target;
  const title = input.value.trim();
  if (!title) return;

  input.value = "";

  await fetch(`/notes/${currentNoteId}/block/${blockId}/task/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  await loadNote(currentNoteId);
}

let sortableInstance = null;

function enableDragAndDrop() {
  const container = document.getElementById("blocksContainer");

  if (sortableInstance) {
    sortableInstance.destroy();
  }

  sortableInstance = new Sortable(container, {
    animation: 150,
    handle: ".drag-bar", // 🔥 only drag using bottom bar
    ghostClass: "drag-ghost",

    onEnd: async function () {
      const newOrder = Array.from(container.children).map(
        (child) => child.dataset.id,
      );

      await fetch(`/notes/${currentNoteId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOrder }),
      });
    },
  });
}

document.addEventListener("mouseup", function (e) {
  setTimeout(() => {
    // important → lets selection register

    const textarea = document.activeElement;

    if (!textarea || textarea.tagName !== "TEXTAREA") {
      document.getElementById("flashcardToolbar").style.display = "none";
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (!start || start === end) {
      document.getElementById("flashcardToolbar").style.display = "none";
      return;
    }

    selectedText = textarea.value.substring(start, end);

    const block = textarea.closest(".block");
    if (!block) return;
    selectedBlockId = block.dataset.id;
    selectedSubjectId = block.dataset.subjectId || null;
    const toolbar = document.getElementById("flashcardToolbar");

    toolbar.innerHTML = `
      <button onclick="openFlashcardForm()">📇 Create Flashcard</button>
      <button onclick="askAIFlashcard()">🤖 Ask AI</button>
    `;

    toolbar.style.position = "absolute";
    toolbar.style.left = e.pageX + "px";
    toolbar.style.top = e.pageY - 40 + "px";
    toolbar.style.display = "block";
  }, 50);
});

let selectedText = "";
let selectedBlockId = "";
let selectedSubjectId = null; // ⭐ ADD THIS

async function createFlashcardFromSelection() {
  if (!selectedText) return;

  const question = "Explain:";
  const answer = selectedText;

  await fetch("/flashcards/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      noteId: currentNoteId,
      subjectId: selectedSubjectId, // ⭐ FIXED HERE
      sourceBlockId: selectedBlockId,
      question,
      answer,
    }),
  });

  document.getElementById("flashcardPopup").style.display = "none";

  alert("Flashcard created!");
}

async function saveFlashcard() {
  const question = document.getElementById("flashcardQuestion").value;
  const answer = document.getElementById("flashcardAnswer").value;

  if (!question) {
    alert("Please enter a question");
    return;
  }

  await fetch("/flashcards/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      noteId: currentNoteId,
      subjectId: selectedSubjectId,
      sourceBlockId: selectedBlockId,
      question,
      answer,
    }),
  });

  closeFlashcardPopup();
}

function closeFlashcardPopup() {
  document.getElementById("flashcardPopup").style.display = "none";
}

function openFlashcardForm() {
  document.getElementById("flashcardQuestion").value = "";
  document.getElementById("flashcardAnswer").value = selectedText;

  document.getElementById("flashcardPopup").dataset.subjectId =
    selectedSubjectId; // store for reference
  document.getElementById("flashcardPopup").style.display = "block";
  document.getElementById("flashcardToolbar").style.display = "none";
}
function askAIFlashcard() {
  alert("AI flashcard generator coming soon!");
}
