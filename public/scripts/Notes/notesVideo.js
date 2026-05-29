let player;
let currentVideoTime = 0;

function onYouTubeIframeAPIReady() {
  // API ready
}
//--------------video player
async function playVideo(url, startTime = 0, blockId = null) {
  window.currentVideoBlockId = blockId;

  const popup = document.createElement("div");
  popup.className = "video-popup";

  const videoId = convertYoutube(url).split("/embed/")[1];

  popup.innerHTML = `
<div class="video-popup-box">

  <button class="popup-close">✕</button>

  <div class="video-layout">

    <div class="video-player">
      <div id="ytPlayer"></div>
    </div>

    <div class="video-notes">

      <h3>Video Notes</h3>

      <textarea
      id="videoNoteInput"
      placeholder="Press * to insert timestamp • Example: *1:24 Important concept"
      ></textarea>

      <button onclick="saveVideoNote()">Add Note</button>

      <div id="videoNotesList"></div>

    </div>

  </div>

</div>
`;

  popup.querySelector(".popup-close").onclick = () => popup.remove();

  document.body.appendChild(popup);

  player = new YT.Player("ytPlayer", {
    videoId: videoId,

    playerVars: {
      start: startTime,
    },

    events: {
      onReady: function () {
        setInterval(() => {
          currentVideoTime = Math.floor(player.getCurrentTime());
        }, 1000);
      },
    },
  });

  loadVideoNotes();
}

function convertYoutube(url) {
  try {
    const u = new URL(url);

    // youtube.com/watch?v=
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // youtu.be short links
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}`;
    }
  } catch (e) {}

  return url;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  return `${m}:${s.toString().padStart(2, "0")}`;
}

document.addEventListener("keydown", (e) => {
  const input = document.getElementById("videoNoteInput");

  if (!input) return;

  if (e.key === "*") {
    e.preventDefault();

    const time = currentVideoTime || 0;

    input.value += `*${formatTime(time)} `;
  }
});

async function saveVideoNote() {
  const text = document.getElementById("videoNoteInput").value.trim();

  if (!text) return;

  const time = currentVideoTime || 0;

  await fetch(`/notes/${currentNoteId}/video-note`, {
    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({
      blockId: currentVideoBlockId,
      text,
      time,
    }),
  });

  document.getElementById("videoNoteInput").value = "";

  loadVideoNotes();
}

async function loadVideoNotes() {
  const res = await fetch(`/notes/${currentNoteId}`);
  const data = await res.json();

  const block = data.note.blocks.find((b) => b.id === currentVideoBlockId);

  const notes = block?.content?.notes || [];

  const container = document.getElementById("videoNotesList");

  container.innerHTML = "";

  notes.forEach((n) => {
    const div = document.createElement("div");

    div.className = "video-note";

    div.innerHTML=`<b>[${formatTime(n.time)}]</b> ${n.text}`;

    div.onclick = () => player.seekTo(n.time);

    container.appendChild(div);
  });
}

function jumpToTime(seconds) {
  const iframe = document.getElementById("videoPlayer");

  iframe.src = iframe.src.split("?")[0] + `?start=${seconds}`;
}
