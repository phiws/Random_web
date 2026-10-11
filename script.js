"use strict";

/* FORMSPREE */

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mjygwora";

/* BOOK CONFIG */

const TOTAL_PAGES = 6;

let isAnimating = false;
let typewriterStarted = false;

/* GET PAGE */

function getPage(number) {
  return document.getElementById(`page${number}`);
}

/* INITIALIZE */

function initializePages() {
  for (let i = 1; i <= TOTAL_PAGES; i++) {
    const page = getPage(i);
    if (!page) continue;

    page.classList.remove("flipped");
    page.style.zIndex = TOTAL_PAGES - i + 1;
  }
}

/* STACK */

function updateStack() {
  for (let i = 1; i <= TOTAL_PAGES; i++) {
    const page = getPage(i);
    if (!page) continue;

    if (page.classList.contains("flipped")) {
      page.style.zIndex = i;
    } else {
      page.style.zIndex = TOTAL_PAGES - i + 1;
    }
  }
}

/* NEXT */

function nextPage(number) {
  if (isAnimating) return;

  const page = getPage(number);
  if (!page) {
    console.error("Page tidak ditemukan:", number);
    return;
  }

  if (page.classList.contains("flipped")) return;

  isAnimating = true;
  page.classList.add("flipped");

  setTimeout(() => {
    updateStack();
    isAnimating = false;

    if (number === 1) {
      startTypewriter();
    }
  }, 900);
}

/* PREVIOUS */

function prevPage(number) {
  if (isAnimating) return;

  const page = getPage(number);
  if (!page) {
    console.error("Page tidak ditemukan:", number);
    return;
  }

  if (!page.classList.contains("flipped")) return;

  isAnimating = true;
  page.classList.remove("flipped");

  setTimeout(() => {
    updateStack();
    isAnimating = false;
  }, 900);
}

/* TYPEWRITER */

function startTypewriter() {
  const element = document.getElementById("typewriter-text");
  if (!element || typewriterStarted) return;

  typewriterStarted = true;

  const text = "Animated text with typewriter effect.";

  let index = 0;
  element.textContent = "";

  function write() {
    if (index >= text.length) return;
    element.textContent += text[index];
    index++;
    setTimeout(write, 45);
  }

  write();
}

/* SENDER — FORMSPREE */

async function sendToFormspree(email, message) {
  const response = await fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email: email, message: message }),
  });

  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok) {
    let detail = "Formspree gagal.";

    if (Array.isArray(result.errors) && result.errors.length) {
      detail = result.errors.map((e) => e.message || "error").join(", ");
    } else if (result.error) {
      detail = result.error;
    }

    throw new Error(detail);
  }

  return "formspree-ok";
}

/* SUBMIT */

async function submitReply() {
  const textarea = document.getElementById("reply-text");
  const emailInput = document.getElementById("reply-email");
  const status = document.getElementById("status-msg");

  if (!textarea || !status) return;

  const message = textarea.value.trim();
  const email = emailInput ? emailInput.value.trim() : "";

  if (!message) {
    status.textContent = "Tulis pesan terlebih dahulu.";
    status.style.color = "#b96d6d";
    textarea.focus();
    return;
  }

  if (!email) {
    status.textContent = "Isi email kamu dulu ya.";
    status.style.color = "#b96d6d";
    if (emailInput) emailInput.focus();
    return;
  }

  status.textContent = "Mengirim pesan...";
  status.style.color = "";

  try {
    await sendToFormspree(email, message);

    status.textContent = "Pesanmu sudah terkirim.";
    status.style.color = "#72876e";
    textarea.value = "";
    if (emailInput) emailInput.value = "";
  } catch (err) {
    console.error("Formspree gagal:", err);
    status.textContent = "Pesan gagal dikirim. Cek koneksi internetmu.";
    status.style.color = "#b96d6d";
  }
}

/* DOM READY */

document.addEventListener("DOMContentLoaded", () => {
  initializePages();

  const form = document.getElementById("reply-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitReply();
    });
  }
});

/* MUSIC PLAYER */

(function initMusic() {
  const player = document.getElementById("music-player");
  const btn = document.getElementById("music-btn");
  const audio = document.getElementById("bg-music");

  if (!player || !btn || !audio) {
    console.warn("Music player: elemen tidak ditemukan");
    return;
  }

  btn.addEventListener("click", () => {
    if (audio.paused) {
      audio.volume = 0.7;

      audio
        .play()
        .then(() => {
          player.classList.add("is-playing");
        })
        .catch((err) => {
          console.error("Gagal memutar audio:", err);
          alert("Lagu tidak bisa diputar. Cek Console untuk detail.");
        });
    } else {
      audio.pause();
      player.classList.remove("is-playing");
    }
  });

  audio.addEventListener("ended", () => {
    player.classList.remove("is-playing");
  });

  audio.addEventListener("error", () => {
    console.error("Audio error:", audio.error);
  });
})();
