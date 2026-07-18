const board = document.querySelector("#board");
const timerElement = document.querySelector("#timer");
const nextNumberElement = document.querySelector("#nextNumber");
const hintElement = document.querySelector("#hint");
const progressBar = document.querySelector("#progressBar");
const completionCard = document.querySelector("#completionCard");
const finalTimeElement = document.querySelector("#finalTime");
const ratingBadge = document.querySelector("#ratingBadge");
const ratingNote = document.querySelector("#ratingNote");
const ratingGuide = document.querySelector("#ratingGuide");
const restartButton = document.querySelector("#restartButton");
const playAgainButton = document.querySelector("#playAgainButton");
const setupScreen = document.querySelector("#setupScreen");
const changeSizeButton = document.querySelector("#changeSizeButton");
const gameTitle = document.querySelector("#gameTitle");
const gameSubtitle = document.querySelector("#gameSubtitle");
const maxNumberElement = document.querySelector("#maxNumber");
const sizeButtons = document.querySelectorAll("[data-size]");
const colorModeButtons = document.querySelectorAll("[data-color-mode]");
const sizeStep = document.querySelector("#sizeStep");
const colorStep = document.querySelector("#colorStep");
const selectedSizeSummary = document.querySelector("#selectedSizeSummary");
const backToSizeButton = document.querySelector("#backToSizeButton");

let gridSize = 5;
let totalNumbers = 25;
let expectedNumber = 1;
let startTime = 0;
let elapsedTime = 0;
let timerFrame = null;
let state = "selecting";
let colorMode = "varied";

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hasAdjacentConsecutiveNumbers(numbers, size) {
  const positions = Array(numbers.length + 1);
  numbers.forEach((number, index) => {
    positions[number] = index;
  });

  for (let number = 1; number < numbers.length; number += 1) {
    const first = positions[number];
    const second = positions[number + 1];
    const rowDistance = Math.abs(Math.floor(first / size) - Math.floor(second / size));
    const columnDistance = Math.abs((first % size) - (second % size));
    if (rowDistance + columnDistance === 1) return true;
  }
  return false;
}

function createNumberLayout(size) {
  const total = size * size;
  const values = Array.from({ length: total }, (_, index) => index + 1);
  let numbers;
  do {
    numbers = shuffle(values);
  } while (hasAdjacentConsecutiveNumbers(numbers, size));
  return numbers;
}

function createNumberColors(numbers, size) {
  const colorsByNumber = Array(numbers.length);
  const colorsByCell = [];

  numbers.forEach((number, cellIndex) => {
    const blockedColors = new Set();
    const row = Math.floor(cellIndex / size);
    const column = cellIndex % size;

    if (row > 0) blockedColors.add(colorsByCell[cellIndex - size]);
    if (column > 0) blockedColors.add(colorsByCell[cellIndex - 1]);
    if (number > 1 && colorsByNumber[number - 2] !== undefined) {
      blockedColors.add(colorsByNumber[number - 2]);
    }
    if (number < numbers.length && colorsByNumber[number] !== undefined) {
      blockedColors.add(colorsByNumber[number]);
    }

    const availableColors = shuffle([0, 1, 2, 3, 4]).filter(
      (color) => !blockedColors.has(color),
    );
    const color = availableColors[0];
    colorsByCell[cellIndex] = color;
    colorsByNumber[number - 1] = color;
  });

  return colorsByNumber;
}

function formatTime(milliseconds) {
  const totalCentiseconds = Math.floor(milliseconds / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function getRatingLimits() {
  const sameColorAdjustment = colorMode === "same" ? 8 : 0;
  const excellentLimit = totalNumbers - sameColorAdjustment;
  const okayLimit = Math.round(totalNumbers * 12) / 10 - sameColorAdjustment;
  return { excellentLimit, okayLimit };
}

function getRating(milliseconds) {
  const seconds = milliseconds / 1000;
  const { excellentLimit, okayLimit } = getRatingLimits();

  if (seconds <= excellentLimit) {
    return { label: "优秀", className: "excellent", note: `在 ${excellentLimit} 秒内完成` };
  }
  if (seconds <= okayLimit) {
    return { label: "尚可", className: "okay", note: `再快一点就能达到优秀` };
  }
  return { label: "需要提高", className: "improve", note: `目标：先进入 ${okayLimit} 秒以内` };
}

function updateTimer(now) {
  if (state !== "running") return;
  elapsedTime = now - startTime;
  timerElement.textContent = formatTime(elapsedTime);
  timerFrame = requestAnimationFrame(updateTimer);
}

function startTimer() {
  if (state !== "ready") return;
  state = "running";
  startTime = performance.now();
  hintElement.textContent = "保持节奏，继续！";
  timerFrame = requestAnimationFrame(updateTimer);
}

function finishGame() {
  elapsedTime = performance.now() - startTime;
  const rating = getRating(elapsedTime);
  const { excellentLimit, okayLimit } = getRatingLimits();
  state = "complete";
  cancelAnimationFrame(timerFrame);
  timerElement.textContent = formatTime(elapsedTime);
  finalTimeElement.textContent = formatTime(elapsedTime);
  ratingBadge.textContent = rating.label;
  ratingBadge.className = `rating-badge ${rating.className}`;
  ratingNote.textContent = rating.note;
  ratingGuide.textContent = `优秀：≤${excellentLimit}秒｜尚可：${excellentLimit}–${okayLimit}秒｜需提高：>${okayLimit}秒`;
  nextNumberElement.textContent = "✓";
  hintElement.textContent = "漂亮！你已经完成全部数字";
  completionCard.classList.add("show");
  completionCard.setAttribute("aria-hidden", "false");
  playAgainButton.focus();
}

function showWrongChoice(tile) {
  tile.classList.remove("wrong");
  void tile.offsetWidth;
  tile.classList.add("wrong");
  hintElement.classList.add("error");
  hintElement.textContent = `现在要找的是 ${expectedNumber}`;
  window.setTimeout(() => {
    hintElement.classList.remove("error");
    if (state === "running") hintElement.textContent = "保持节奏，继续！";
  }, 650);
}

function handleTileClick(event) {
  const tile = event.currentTarget;
  const value = Number(tile.dataset.value);
  if (state === "complete" || tile.classList.contains("done")) return;
  if (value !== expectedNumber) {
    showWrongChoice(tile);
    return;
  }

  if (expectedNumber === 1) startTimer();
  tile.classList.add("done");
  tile.disabled = true;
  expectedNumber += 1;
  progressBar.style.width = `${((expectedNumber - 1) / totalNumbers) * 100}%`;

  if (expectedNumber === totalNumbers + 1) {
    finishGame();
  } else {
    nextNumberElement.textContent = expectedNumber;
  }
}

function newGame() {
  cancelAnimationFrame(timerFrame);
  expectedNumber = 1;
  startTime = 0;
  elapsedTime = 0;
  state = "ready";
  timerElement.textContent = "00:00.00";
  nextNumberElement.textContent = "1";
  hintElement.textContent = "点击数字 1，计时开始";
  hintElement.classList.remove("error");
  progressBar.style.width = "0%";
  completionCard.classList.remove("show");
  completionCard.setAttribute("aria-hidden", "true");

  gameTitle.textContent = `顺序 ${totalNumbers}`;
  const colorDescription = colorMode === "same" ? "同色棋盘" : "多色棋盘";
  gameSubtitle.textContent = `从 1 开始，按顺序点到 ${totalNumbers} · ${colorDescription}`;
  maxNumberElement.textContent = totalNumbers;
  board.style.setProperty("--grid-size", gridSize);
  board.setAttribute("aria-label", `${gridSize}乘${gridSize}数字游戏棋盘`);

  board.replaceChildren();
  const numbers = createNumberLayout(gridSize);
  const numberColors = createNumberColors(numbers, gridSize);
  const fragment = document.createDocumentFragment();
  numbers.forEach((number) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = colorMode === "same"
      ? "tile color-same"
      : `tile color-${numberColors[number - 1]}`;
    tile.dataset.value = number;
    tile.textContent = number;
    tile.setAttribute("aria-label", `数字 ${number}`);
    tile.addEventListener("click", handleTileClick);
    fragment.appendChild(tile);
  });
  board.appendChild(fragment);
}

function selectSize(size) {
  gridSize = size;
  totalNumbers = size * size;
  selectedSizeSummary.textContent = `已选择 ${size} × ${size} 棋盘`;
  setupScreen.setAttribute("aria-labelledby", "colorTitle");
  sizeStep.hidden = true;
  colorStep.hidden = false;
  colorModeButtons[0].focus();
}

function selectColorMode(mode) {
  colorMode = mode;
  setupScreen.hidden = true;
  newGame();
}

function showSizeStep() {
  setupScreen.setAttribute("aria-labelledby", "setupTitle");
  colorStep.hidden = true;
  sizeStep.hidden = false;
  setupScreen.querySelector(`[data-size="${gridSize}"]`).focus();
}

function openSizePicker() {
  cancelAnimationFrame(timerFrame);
  state = "selecting";
  completionCard.classList.remove("show");
  setupScreen.hidden = false;
  showSizeStep();
}

sizeButtons.forEach((button) => {
  button.addEventListener("click", () => selectSize(Number(button.dataset.size)));
});
colorModeButtons.forEach((button) => {
  button.addEventListener("click", () => selectColorMode(button.dataset.colorMode));
});
backToSizeButton.addEventListener("click", showSizeStep);
restartButton.addEventListener("click", newGame);
playAgainButton.addEventListener("click", newGame);
changeSizeButton.addEventListener("click", openSizePicker);
