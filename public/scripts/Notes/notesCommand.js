/* ===== COMMAND TRIGGERS ===== */

document
  .getElementById("commandInput")
  .addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const value = this.value.trim();

      if (value === "/addblock") {
        addTextBlock();
        this.value = "";
        return;
      }

      if (value === "?img") {
        openImageModal();
        this.value = "";
        return;
      }
    }
  });

document.addEventListener("keyup", (e) => {
  if (e.target.tagName !== "TEXTAREA") return;

  const textarea = e.target;

  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);

  const match = textBefore.match(/\/(\w*)$/);

  if (match) {
    const query = match[1].toLowerCase();

    const filtered = editorCommands.filter((c) => c.name.startsWith(query));

    if (filtered.length) {
      commandIndex = 0;
      showCommandPopup(textarea);
      renderCommandList(filtered, textarea);
    }
  } else {
    hideCommandPopup();
  }
});

/* =========================
COMMAND REGISTRY
========================= */

const editorCommands = [
  { name: "addblock", label: "Add block", icon: "fi fi-rr-plus" },

  { name: "img", label: "Insert image", icon: "fi fi-rr-picture" },

  {
    name: "video",
    label: "Insert YouTube video",
    icon: "fi fi-rr-video-camera",
  },

  { name: "search", label: "Search web", icon: "fi fi-rr-search" },

  { name: "wiki", label: "Search Wikipedia", icon: "fi fi-rr-book" },

  { name: "task", label: "Insert task block", icon: "fi fi-rr-checkbox" },

  { name: "draw", label: "Insert whiteboard", icon: "fi fi-rr-pencil" },

  { name: "summarize", label: "Summarize block", icon: "fi fi-rr-brain" },

  { name: "rewrite", label: "Rewrite with AI", icon: "fi fi-rr-magic-wand" },

  {
    name: "elaborate",
    label: "Elaborate the content",
    icon: "fi fi-tr-analytics-magnifying-glass",
  },
  { name: "ai", label: "Custom AI prompt", icon: "fi fi-rr-robot" },
];

/* =========================
COMMAND POPUP
========================= */
// create command popup
document.addEventListener("DOMContentLoaded", () => {
  commandPopup = document.createElement("div");
  commandPopup.id = "commandPopup";

  commandPopup.style.position = "absolute";
  commandPopup.style.display = "none";
  commandPopup.style.zIndex = "9999";

  document.body.appendChild(commandPopup);
});

let commandPopup = null;
let commandIndex = 0;

function hideCommandPopup() {
  if (commandPopup) commandPopup.style.display = "none";
}

function renderCommandList(commands, textarea) {
  commandPopup.innerHTML = "";

  commands.forEach((cmd) => {
    const item = document.createElement("div");
    item.className = "command-item";

    item.innerHTML = `
<i class="${cmd.icon}"></i>
<div class="cmd-text">
<b>/${cmd.name}</b>
<span>${cmd.label}</span>
</div>
`;

    item.onclick = () => {
      autocompleteCommand(textarea, cmd.name);
      hideCommandPopup();
    };

    commandPopup.appendChild(item);
  });
}

function autocompleteCommand(textarea, command) {
  const cursorPos = textarea.selectionStart;

  const before = textarea.value.substring(0, cursorPos);
  const after = textarea.value.substring(cursorPos);

  const newBefore = before.replace(/\/(\w*)$/, "/" + command + " ");

  textarea.value = newBefore + after;

  textarea.focus();

  // move cursor after command
  const newCursor = newBefore.length;
  textarea.setSelectionRange(newCursor, newCursor);
}

function showCommandPopup(textarea) {
  const rect = getCaretCoordinates(textarea);

  commandPopup.style.left = rect.left + window.scrollX + "px";
  commandPopup.style.top = rect.bottom + window.scrollY + 6 + "px";

  commandPopup.style.display = "block";
}

function getCaretCoordinates(textarea) {
  const div = document.createElement("div");

  const style = getComputedStyle(textarea);

  for (const prop of style) {
    div.style[prop] = style[prop];
  }

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";

  div.textContent = textarea.value.substring(0, textarea.selectionStart);

  const span = document.createElement("span");
  span.textContent = ".";

  div.appendChild(span);

  document.body.appendChild(div);

  const rect = span.getBoundingClientRect();

  document.body.removeChild(div);

  return rect;
}
async function detectBlockCommands(textarea, e) {
  if (e.key !== "Enter") return;

  let value = textarea.value.trim();
  const parentBlock = textarea.closest(".block");

  /* ========= ADD BLOCK ========= */

  if (value.includes("/addblock")) {
    textarea.value = value.replace("/addblock", "").trim();
    await saveBlock(parentBlock);
    addTextBlock();
    return;
  }

  /* ========= IMAGE ========= */

  if (value.includes("?img")) {
    textarea.value = value.replace("?img", "").trim();
    await saveBlock(parentBlock);
    openImageModal();
    return;
  }

  /* ========= HEADING ========= */

  const headingMatch = value.match(/^(#{1,3})\s*(.*)/);

  if (headingMatch) {
    const level = headingMatch[1].length;
    textarea.value = headingMatch[2];
    parentBlock.dataset.type = "h" + level;
    await saveBlock(parentBlock);
    return;
  }

  /* ================= AI COMMAND ================= */

  if (e.key === "Enter") {
    const aiMatch = value.match(/^\/ai\s+"([^"]+)"([\s\S]*)$/i);

    if (aiMatch) {
      e.preventDefault();

      const prompt = aiMatch[1];
      const content = aiMatch[2].trim();

      textarea.value = content;

      await saveBlock(parentBlock);

      await runAIRequest({
        type: "block",
        prompt: prompt,
        content: content,
        subjectId: currentSubjectId || null,
        blockId: parentBlock.dataset.id,
      });

      return;
    }
  }

  /* ========= API COMMANDS ========= */
  if (e.key === "Enter") {
    const commandMatch = value.match(/^\/(search|wiki)\s+(.*)/i); //allowas /search /wiki

    if (commandMatch) {
      const command = commandMatch[1].toLowerCase();
      const query = commandMatch[2].trim();

      textarea.value = "";

      await handleApiCommand(command, query);
      return;
    }
  }
  /* ========= Task block ========= */

  if (value.includes("/task")) {
    textarea.value = "";

    await fetch(`/notes/${currentNoteId}/block/add-task-block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    await loadNote(currentNoteId);
    return;
  }

  /* ========= WHITEBOARD ========= */

  if (value.includes("/draw")) {
    textarea.value = "";

    await fetch(`/notes/${currentNoteId}/block/add-whiteboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    await loadNote(currentNoteId);
    return;
  }
  /* ========= VIDEO ========= */

  if (value.startsWith("/video ")) {
    const url = value.replace("/video ", "").trim();

    textarea.value = "";

    await fetch(`/notes/${currentNoteId}/block/add-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
      }),
    });

    await loadNote(currentNoteId);

    return;
  }

  /* ========= TABLE ========= */

  if (value === "/table") {
    e.preventDefault();

    textarea.value = "";

    await fetch(`/notes/${currentNoteId}/block/add-table`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: 3,
        cols: 3,
      }),
    });

    await loadNote(currentNoteId);
    return;
  }

  /* ========= SUMMARIZE ========= */

  if (value.includes("/summarize")) {
    e.preventDefault();

    const originalBlockText = textarea.value;

    const cleaned = originalBlockText.replace("/summarize", "").trim();

    const content = cleaned.length > 0 ? cleaned : originalBlockText;

    console.log("CONTENT SENT TO AI:", content);

    textarea.value = cleaned;

    await saveBlock(parentBlock);

    await runBlockAI({
      prompt:
        "Summarize this note clearly and concisely. \n\n NOTE: \n" + content,
      content: content,
      blockId: parentBlock.dataset.id,
    });

    return;
  }
  /* ========= REWRITE ========= */
  if (value.includes("/rewrite")) {
    e.preventDefault();

    const originalText = textarea.value;

    const content = originalText.replace("/rewrite", "").trim() || originalText;

    textarea.value = content;

    await saveBlock(parentBlock);

    await runBlockAI({
      prompt:
        "Rewrite this note in a clearer and better way while keeping the meaning. \n\n note \n" +
        content,
      content: content,
      blockId: parentBlock.dataset.id,
    });

    return;
  }
   /* ========= REWRITE ========= */
  if (value.includes("/elaborate")) {
    e.preventDefault();

    const originalText = textarea.value;

    const content = originalText.replace("/elaborate", "").trim() || originalText;

    textarea.value = content;

    await saveBlock(parentBlock);

    await runBlockAI({
      prompt:
        "Elaborate this note in a clearer way while Adding new required info  \n\n note \n" +
        content,
      content: content,
      blockId: parentBlock.dataset.id,
    });

    return;
  }
}
