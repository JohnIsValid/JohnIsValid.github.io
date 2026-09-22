const setupScreen = document.querySelector("#setupScreen");
const durationStep = document.querySelector("#durationStep");
const intervalStep = document.querySelector("#intervalStep");
const durationSummary = document.querySelector("#durationSummary");
const gameShell = document.querySelector("#gameShell");
const timer = document.querySelector("#timer");
const intervalDisplay = document.querySelector("#intervalDisplay");
const leftDot = document.querySelector("#leftDot");
const rightDot = document.querySelector("#rightDot");
const stageHint = document.querySelector("#stageHint");
const completeLayer = document.querySelector("#completeLayer");
const completeText = document.querySelector("#completeText");

let duration = 30;
let interval = 1000;
let startedAt = 0;
let timerFrame = null;
let flashTimer = null;
let state = "setup";

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `00:${String(seconds).padStart(2, "0")}`;
}

function clearTimers() {
  cancelAnimationFrame(timerFrame);
  clearTimeout(flashTimer);
  timerFrame = null;
  flashTimer = null;
}

function updateTimer(now) {
  if (state !== "running") return;
  const remaining = duration * 1000 - (now - startedAt);
  timer.textContent = formatTime(remaining);
  if (remaining <= 0) {
    finishSession();
    return;
  }
  timerFrame = requestAnimationFrame(updateTimer);
}

function flashSide() {
  if (state !== "running") return;
  const dot = Math.random() < 0.5 ? leftDot : rightDot;
  dot.classList.remove("flash");
  void dot.offsetWidth;
  dot.classList.add("flash");
  flashTimer = window.setTimeout(flashSide, interval);
}

function startSession() {
  clearTimers();
  state = "running";
  gameShell.hidden = false;
  setupScreen.hidden = true;
  completeLayer.classList.remove("show");
  completeLayer.setAttribute("aria-hidden", "true");
  leftDot.classList.remove("flash");
  rightDot.classList.remove("flash");
  timer.textContent = formatTime(duration * 1000);
  intervalDisplay.textContent = `${(interval / 1000).toFixed(1)} 秒`;
  stageHint.textContent = "保持视线在中间绿点，用余光觉察左右闪烁。";
  startedAt = performance.now();
  timerFrame = requestAnimationFrame(updateTimer);
  flashTimer = window.setTimeout(flashSide, interval);
}

function finishSession() {
  if (state !== "running") return;
  clearTimers();
  state = "complete";
  timer.textContent = "00:00";
  leftDot.classList.remove("flash");
  rightDot.classList.remove("flash");
  stageHint.textContent = "本轮训练完成。";
  completeText.textContent = `你已完成 ${duration} 秒的专注练习。`;
  completeLayer.classList.add("show");
  completeLayer.setAttribute("aria-hidden", "false");
  document.querySelector("#againButton").focus();
}

function openSettings() {
  clearTimers();
  state = "setup";
  gameShell.hidden = true;
  completeLayer.classList.remove("show");
  completeLayer.setAttribute("aria-hidden", "true");
  setupScreen.hidden = false;
  durationStep.hidden = false;
  intervalStep.hidden = true;
  document.querySelector(`[data-duration="${duration}"]`).focus();
}

document.querySelectorAll("[data-duration]").forEach((button) => {
  button.addEventListener("click", () => {
    duration = Number(button.dataset.duration);
    durationSummary.textContent = `本局时长：${duration} 秒`;
    durationStep.hidden = true;
    intervalStep.hidden = false;
    document.querySelector("[data-interval='1000']").focus();
  });
});

document.querySelectorAll("[data-interval]").forEach((button) => {
  button.addEventListener("click", () => {
    interval = Number(button.dataset.interval);
    startSession();
  });
});

document.querySelector("#backButton").addEventListener("click", () => {
  intervalStep.hidden = true;
  durationStep.hidden = false;
});
document.querySelector("#settingsButton").addEventListener("click", openSettings);
document.querySelector("#restartButton").addEventListener("click", startSession);
document.querySelector("#againButton").addEventListener("click", startSession);
document.querySelector("#completeSettingsButton").addEventListener("click", openSettings);
