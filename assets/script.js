const form = document.querySelector("#chat-form");
const input = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#messages");
const apiStatus = document.querySelector("#api-status");
const apiStatusLabel = apiStatus.querySelector(".status-label");
const newChatButton = document.querySelector("#new-chat");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setApiStatus(state, label) {
  apiStatus.dataset.state = state;
  apiStatusLabel.textContent = label;
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || result.status !== "ok") {
      throw new Error("Query service unavailable");
    }
    setApiStatus("online", "Query API connected");
  } catch {
    setApiStatus("offline", "Query API offline");
  }
}

function scrollToLatest() {
  messages.scrollTop = messages.scrollHeight;
}

function addMessage(role, text, options = {}) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  if (options.error) article.classList.add("error-message");

  const avatar = document.createElement("div");
  avatar.className = `message-avatar ${role === "user" ? "user-avatar" : "assistant-avatar"}`;
  avatar.setAttribute("aria-hidden", "true");
  if (role === "user") {
    avatar.textContent = "S";
  } else {
    const ball = document.createElement("span");
    avatar.append(ball);
  }

  const content = document.createElement("div");
  content.className = "message-content";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const name = document.createElement("span");
  name.textContent = role === "user" ? "You" : "RollingBall";
  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  meta.append(name, time);

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.append(paragraph);
  content.append(meta, bubble);
  article.append(avatar, content);
  messages.append(article);

  if (Array.isArray(options.toolCalls) && options.toolCalls.length) {
    appendToolCalls(content, options.toolCalls);
  }
  scrollToLatest();
  return article;
}

function appendToolCalls(container, toolCalls) {
  const details = document.createElement("details");
  details.className = "tool-details";
  const summary = document.createElement("summary");
  summary.textContent = `${toolCalls.length} ${toolCalls.length === 1 ? "tool" : "tools"} used`;
  const list = document.createElement("ul");

  for (const call of toolCalls) {
    const item = document.createElement("li");
    const toolName = document.createElement("span");
    toolName.textContent = call.name || "Tool";
    item.append(toolName);
    if (call.result !== undefined) {
      const result = document.createElement("pre");
      result.textContent = typeof call.result === "string"
        ? call.result
        : JSON.stringify(call.result, null, 2);
      item.append(result);
    }
    list.append(item);
  }

  details.append(summary, list);
  container.append(details);
}

function showTyping() {
  const article = document.createElement("article");
  article.className = "message assistant-message";
  article.setAttribute("aria-label", "RollingBall is responding");
  article.innerHTML = '<div class="message-avatar assistant-avatar" aria-hidden="true"><span></span></div><div class="message-content"><div class="message-meta"><span>RollingBall</span></div><div class="message-bubble typing-bubble"><span></span><span></span><span></span></div></div>';
  messages.append(article);
  scrollToLatest();
  return article;
}

function setSending(sending) {
  sendButton.disabled = sending;
  input.disabled = sending;
  sendButton.setAttribute("aria-label", sending ? "Sending message" : "Send message");
}

async function submitQuery(query) {
  addMessage("user", query);
  const typing = showTyping();
  setSending(true);

  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const result = await response.json();
    if (!response.ok) {
      const detail = typeof result.detail === "string"
        ? result.detail
        : JSON.stringify(result.detail || result);
      throw new Error(detail || `Query failed (${response.status})`);
    }
    if (typeof result.answer !== "string" || !result.answer.trim()) {
      throw new Error("The query API returned no answer.");
    }
    addMessage("assistant", result.answer, { toolCalls: result.tool_calls });
    setApiStatus("online", "Query API connected");
  } catch (error) {
    addMessage("assistant", error.message || "The query could not be completed.", { error: true });
    if (error instanceof TypeError || /unavailable|failed to fetch/i.test(error.message)) {
      setApiStatus("offline", "Query API unavailable");
    }
  } finally {
    typing.remove();
    setSending(false);
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query || sendButton.disabled) return;
  input.value = "";
  input.style.height = "auto";
  submitQuery(query);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    input.focus();
    input.dispatchEvent(new Event("input"));
  });
});

newChatButton.addEventListener("click", () => {
  messages.replaceChildren();
  addMessage("assistant", "Hey there. What can I help you find across the city?");
  input.value = "";
  input.style.height = "auto";
  input.focus();
});

checkApiStatus();

const canvas = document.querySelector("#motion-canvas");
const context = canvas.getContext("2d");
const particles = [];
const colors = ["67, 221, 209", "171, 227, 129", "255, 136, 77"];
let width = 0;
let height = 0;
let frame = 0;

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function addParticle(x, y) {
  if (particles.length >= 45) particles.shift();
  particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 1.6,
    vy: (Math.random() - 0.5) * 1.6,
    radius: Math.random() * 3 + 1.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 1,
    decay: Math.random() * 0.009 + 0.005,
  });
}

function drawParticles() {
  if (reducedMotion) return;
  frame += 1;
  if (frame % 7 === 0 && particles.length < 15) {
    addParticle(width * (0.57 + Math.random() * 0.32), height * (0.2 + Math.random() * 0.65));
  }
  context.clearRect(0, 0, width, height);
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= particle.decay;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(${particle.color}, ${Math.max(particle.life, 0) * 0.48})`;
    context.fill();
    if (particle.life <= 0) particles.splice(index, 1);
  }
  requestAnimationFrame(drawParticles);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
if (!reducedMotion) drawParticles();
