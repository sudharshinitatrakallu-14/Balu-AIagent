const tasks = [
  { id: "essay", title: "Finish history essay draft", subject: "History · 45 min", due: "Due tomorrow", priority: "DO FIRST", rank: 1 },
  { id: "chem", title: "Review chemistry: bonding", subject: "Chemistry · 30 min", due: "Quiz Friday", priority: "UP NEXT", rank: 2 },
  { id: "reading", title: "Read chapter 6 and take notes", subject: "Biology · 25 min", due: "Due Thursday", priority: "WHEN READY", rank: 3 },
];

const taskList = document.querySelector("#task-list");
const focusTask = document.querySelector("#focus-task");
const timerDisplay = document.querySelector("#timer-display");
const focusToggle = document.querySelector("#focus-toggle");
const sessionStatus = document.querySelector("#session-status-text");
const sessionIndicator = document.querySelector("#session-indicator");
const toast = document.querySelector("#toast");
const nudgeToast = document.querySelector("#nudge-toast");
let secondsRemaining = 25 * 60;
let timerInterval;
let nudgeTimeout;
let toastTimeout;
let completedMinutes = 86;

function renderTasks() {
  taskList.innerHTML = tasks.map((task) => `
    <label class="task-row" data-task-row="${task.id}">
      <input class="task-check" type="checkbox" data-task-check="${task.id}" aria-label="Mark ${task.title} complete" />
      <span class="task-copy"><strong>${task.title}</strong><small>${task.subject}</small></span>
      <span class="task-priority">${task.priority}</span>
      <span class="task-due">${task.due}</span>
    </label>`).join("");

  focusTask.innerHTML = tasks.map((task) => `<option value="${task.id}">${task.title}</option>`).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 2800);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateTimer() {
  secondsRemaining = Math.max(0, secondsRemaining - 1);
  timerDisplay.textContent = formatTime(secondsRemaining);
  if (secondsRemaining <= 0) {
    stopFocus();
    showToast("Focus block complete. Take a short screen-free break.");
    secondsRemaining = 5 * 60;
    timerDisplay.textContent = formatTime(secondsRemaining);
    document.querySelector("#timer-caption").textContent = "Your break is ready. Step away from the screen.";
    return;
  }
}

function startFocus() {
  if (timerInterval) return;
  focusToggle.textContent = "Pause focus";
  sessionStatus.textContent = "FOCUSING ON YOUR TASK";
  sessionIndicator.classList.add("is-running");
  document.querySelector("#timer-caption").textContent = "Stay with this one thing. You can do it.";
  timerInterval = setInterval(updateTimer, 1000);
  nudgeTimeout = setTimeout(() => {
    if (timerInterval) {
      document.querySelector("#nudge-message").textContent = "A quick check-in: are you still with your task? No guilt, just a chance to reset.";
      nudgeToast.hidden = false;
    }
  }, 18000);
  showToast("Focus block started. Balu will check in if your focus drifts.");
}

function stopFocus() {
  clearInterval(timerInterval);
  clearTimeout(nudgeTimeout);
  timerInterval = undefined;
  focusToggle.textContent = "Start focus";
  sessionStatus.textContent = "READY WHEN YOU ARE";
  sessionIndicator.classList.remove("is-running");
}

function pauseFocus() {
  stopFocus();
  showToast("Focus paused. Pick it up when you're ready.");
}

function changeView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    const isCurrent = view.id === `${viewName}-view`;
    view.hidden = !isCurrent;
    view.classList.toggle("is-visible", isCurrent);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    const isCurrent = button.dataset.view === viewName;
    button.classList.toggle("is-active", isCurrent);
    if (isCurrent) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

const ollamaEndpoint = "http://localhost:11434/api/chat";
const ollamaModel = "llama3.2:latest";
let conversationHistory = [];
let chatPending = false;

function getBaluInstructions() {
  const taskContext = tasks.map((task) => {
    const isComplete = document.querySelector(`[data-task-check="${task.id}"]`)?.checked;
    return `- ${isComplete ? "Done" : task.priority}: ${task.title} (${task.subject}; ${task.due})`;
  }).join("\n");

  return `You are Balu, a warm and relaxed study buddy. Talk like a supportive friend, not a formal assistant; avoid forced slang. Respond to what the student actually said, and offer one useful next step when it fits. Keep replies concise and natural. Answer in the language the student uses, including Telugu when appropriate. Never claim to be human.\n\nThe student's current tasks:\n${taskContext}\n\nThe distraction figures shown in this prototype are sample data only: 24 minutes total, including social scrolling (10), messages (8), and other breaks (6). They are not tracked from the student's device. Be clear about that if asked. Do not invent task details or claim to monitor apps or device activity.`;
}

function appendChatMessage(kind, text) {
  const messages = document.querySelector("#chat-messages");
  const message = document.createElement("div");
  message.className = `message message-${kind}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  const speaker = document.createElement("span");
  speaker.className = "message-time";
  speaker.textContent = kind === "user" ? "You" : "Balu";
  message.append(paragraph, speaker);
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

async function sendMessage(text) {
  const cleanText = text.trim();
  if (!cleanText || chatPending) return;

  const input = document.querySelector("#chat-input");
  const sendButton = document.querySelector("#chat-form button[type='submit']");
  appendChatMessage("user", cleanText);
  const thinkingMessage = appendChatMessage("balu", "Thinking...");
  thinkingMessage.classList.add("is-thinking");
  chatPending = true;
  input.disabled = true;
  sendButton.disabled = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  conversationHistory.push({ role: "user", content: cleanText });

  try {
    const response = await fetch(ollamaEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [{ role: "system", content: getBaluInstructions() }, ...conversationHistory],
        stream: false,
        options: { temperature: 0.75, num_predict: 220 }
      }),
      signal: controller.signal
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Ollama returned ${response.status}.`);
    const reply = result.message?.content?.trim();
    if (!reply) throw new Error("Ollama returned an empty reply.");

    conversationHistory.push({ role: "assistant", content: reply });
    conversationHistory = conversationHistory.slice(-12);
    thinkingMessage.querySelector("p").textContent = reply;
    thinkingMessage.classList.remove("is-thinking");
  } catch (error) {
    conversationHistory.pop();
    thinkingMessage.remove();
    const detail = error.name === "AbortError"
      ? "That reply took too long. Try a shorter message."
      : "I couldn't reach Ollama. Make sure it's running on this computer, then try again.";
    appendChatMessage("balu", detail);
  } finally {
    clearTimeout(timeoutId);
    chatPending = false;
    input.disabled = false;
    sendButton.disabled = false;
    input.focus();
  }
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => changeView(button.dataset.view)));
document.querySelectorAll("[data-view-link]").forEach((button) => button.addEventListener("click", () => changeView(button.dataset.viewLink)));
document.querySelectorAll("[data-go-focus]").forEach((button) => button.addEventListener("click", () => changeView("focus")));

taskList.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-task-check]");
  if (!checkbox) return;
  const row = document.querySelector(`[data-task-row="${checkbox.dataset.taskCheck}"]`);
  row.classList.toggle("is-done", checkbox.checked);
  const completedCount = document.querySelectorAll("[data-task-check]:checked").length;
  showToast(checkbox.checked ? "Priority checked off. Nice progress." : "Task moved back to your list.");
  if (completedCount === tasks.length) showToast("All priorities done. Take a well-earned break.");
});

focusToggle.addEventListener("click", () => timerInterval ? pauseFocus() : startFocus());
document.querySelector("#focus-reset").addEventListener("click", () => {
  stopFocus();
  secondsRemaining = 25 * 60;
  timerDisplay.textContent = formatTime(secondsRemaining);
  document.querySelector("#timer-caption").textContent = "A focused block, then a proper break.";
  nudgeToast.hidden = true;
  showToast("Timer reset to 25 minutes.");
});
document.querySelector("#distraction-test").addEventListener("click", () => {
  document.querySelector("#nudge-message").textContent = "It happens. Take one breath, close the distraction, and come back to your next small step.";
  nudgeToast.hidden = false;
});
document.querySelector("#nudge-return").addEventListener("click", () => {
  nudgeToast.hidden = true;
  if (!timerInterval) startFocus();
  else showToast("Welcome back. Keep going with your task.");
});
document.querySelector("#nudge-close").addEventListener("click", () => { nudgeToast.hidden = true; });
document.querySelector("#chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#chat-input");
  sendMessage(input.value);
  input.value = "";
  input.focus();
});
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => sendMessage(button.dataset.prompt)));

document.querySelector("#today-date").textContent = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
renderTasks();