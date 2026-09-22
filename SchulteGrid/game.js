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
const averageClickTimeElement = document.querySelector("#averageClickTime");
const fastestClickTimeElement = document.querySelector("#fastestClickTime");
const slowestClickTimeElement = document.querySelector("#slowestClickTime");
const clickTimeChart = document.querySelector("#clickTimeChart");
const clickTimeTooltip = document.querySelector("#clickTimeTooltip");
const clickTimeList = document.querySelector("#clickTimeList");
const restartButton = document.querySelector("#restartButton");
const playAgainButton = document.querySelector("#playAgainButton");
const setupScreen = document.querySelector("#setupScreen");
const changeSizeButton = document.querySelector("#changeSizeButton");
const gameTitle = document.querySelector("#gameTitle");
const gameSubtitle = document.querySelector("#gameSubtitle");
const maxNumberElement = document.querySelector("#maxNumber");
const sizeButtons = document.querySelectorAll("[data-size]");
const colorModeButtons = document.querySelectorAll("[data-color-mode]");
const trialModeButtons = document.querySelectorAll("[data-ultimate-trial]");
const sizeStep = document.querySelector("#sizeStep");
const colorStep = document.querySelector("#colorStep");
const challengeStep = document.querySelector("#challengeStep");
const selectedSizeSummary = document.querySelector("#selectedSizeSummary");
const selectedModeSummary = document.querySelector("#selectedModeSummary");
const backToSizeButton = document.querySelector("#backToSizeButton");
const backToColorButton = document.querySelector("#backToColorButton");

let gridSize = 5;
let totalNumbers = 25;
let expectedNumber = 1;
let startTime = 0;
let elapsedTime = 0;
let timerFrame = null;
let state = "selecting";
let colorMode = "varied";
let ultimateTrial = false;
let lastCorrectClickTime = 0;
let clickDurations = [];
let chartPoints = [];
let selectedChartPoint = -1;

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

function formatDuration(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)} 秒`;
}

function getRatingLimits() {
  const sameColorAdjustment = colorMode === "same" ? 8 : 0;
  const trialTimeMultiplier = ultimateTrial ? 1.45 : 1;
  const excellentLimit = Math.round(
    (totalNumbers - sameColorAdjustment) * trialTimeMultiplier * 100,
  ) / 100;
  const okayLimit = Math.round(
    (Math.round(totalNumbers * 12) / 10 - sameColorAdjustment) * trialTimeMultiplier * 100,
  ) / 100;
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

function startTimer(now = performance.now()) {
  if (state !== "ready") return;
  state = "running";
  startTime = now;
  lastCorrectClickTime = now;
  hintElement.textContent = "保持节奏，继续！";
  timerFrame = requestAnimationFrame(updateTimer);
}

function getRunningHint() {
  return ultimateTrial ? `棋盘已刷新，寻找 ${expectedNumber}` : "保持节奏，继续！";
}

function drawClickTimeChart() {
  const context = clickTimeChart.getContext("2d");
  const rect = clickTimeChart.getBoundingClientRect();
  const width = Math.max(280, rect.width);
  const height = Math.max(180, rect.height);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  clickTimeChart.width = Math.round(width * pixelRatio);
  clickTimeChart.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  chartPoints = [];

  if (!clickDurations.length) return;

  const padding = { top: 16, right: 14, bottom: 30, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxDuration = Math.max(...clickDurations.map((item) => item.duration));
  const axisMax = Math.max(500, Math.ceil(maxDuration / 500) * 500);
  const xForIndex = (index) => padding.left
    + (clickDurations.length === 1 ? chartWidth / 2 : (index / (clickDurations.length - 1)) * chartWidth);
  const yForDuration = (duration) => padding.top + chartHeight - (duration / axisMax) * chartHeight;
  chartPoints = clickDurations.map((item, index) => ({
    index,
    item,
    x: xForIndex(index),
    y: yForDuration(item.duration),
  }));

  context.font = '11px Inter, "PingFang SC", sans-serif';
  context.textBaseline = "middle";
  context.lineWidth = 1;
  for (let step = 0; step <= 4; step += 1) {
    const y = padding.top + (chartHeight / 4) * step;
    const value = axisMax * (1 - step / 4);
    context.strokeStyle = "rgba(30, 29, 26, .09)";
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillStyle = "#8a877f";
    context.textAlign = "right";
    context.fillText(`${(value / 1000).toFixed(1)}s`, padding.left - 8, y);
  }

  const labelEvery = Math.max(1, Math.ceil(clickDurations.length / 7));
  clickDurations.forEach((item, index) => {
    if (index % labelEvery !== 0 && index !== clickDurations.length - 1) return;
    context.fillStyle = "#8a877f";
    context.textAlign = "center";
    context.fillText(String(item.number), xForIndex(index), height - 11);
  });

  const areaGradient = context.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
  areaGradient.addColorStop(0, "rgba(232, 75, 53, .24)");
  areaGradient.addColorStop(1, "rgba(232, 75, 53, 0)");
  context.beginPath();
  context.moveTo(xForIndex(0), padding.top + chartHeight);
  clickDurations.forEach((item, index) => {
    context.lineTo(xForIndex(index), yForDuration(item.duration));
  });
  context.lineTo(xForIndex(clickDurations.length - 1), padding.top + chartHeight);
  context.closePath();
  context.fillStyle = areaGradient;
  context.fill();

  context.beginPath();
  clickDurations.forEach((item, index) => {
    const x = xForIndex(index);
    const y = yForDuration(item.duration);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = "#e84b35";
  context.lineWidth = 2.5;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();

  clickDurations.forEach((item, index) => {
    context.beginPath();
    context.arc(xForIndex(index), yForDuration(item.duration), 3.2, 0, Math.PI * 2);
    context.fillStyle = "#fffdf8";
    context.fill();
    context.strokeStyle = "#e84b35";
    context.lineWidth = 2;
    context.stroke();
  });

  if (selectedChartPoint >= 0 && chartPoints[selectedChartPoint]) {
    const point = chartPoints[selectedChartPoint];
    context.beginPath();
    context.arc(point.x, point.y, 7, 0, Math.PI * 2);
    context.fillStyle = "#e84b35";
    context.fill();
    context.strokeStyle = "#fffdf8";
    context.lineWidth = 3;
    context.stroke();
    positionChartTooltip(point);
  }
}

function positionChartTooltip(point) {
  const container = clickTimeChart.parentElement;
  const minimumLeft = 76;
  const maximumLeft = Math.max(minimumLeft, container.clientWidth - minimumLeft);
  const left = Math.min(
    maximumLeft,
    Math.max(minimumLeft, clickTimeChart.offsetLeft + point.x),
  );
  const placeBelow = point.y < 58;

  clickTimeTooltip.textContent = `寻找 ${point.item.number}：${formatDuration(point.item.duration)}`;
  clickTimeTooltip.style.left = `${left}px`;
  clickTimeTooltip.style.top = `${clickTimeChart.offsetTop + point.y}px`;
  clickTimeTooltip.classList.toggle("below", placeBelow);
  clickTimeTooltip.hidden = false;
}

function selectChartPoint(index) {
  if (!chartPoints[index]) return;
  selectedChartPoint = index;
  drawClickTimeChart();
}

function handleChartClick(event) {
  if (!chartPoints.length) return;

  const rect = clickTimeChart.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const nearestPoint = chartPoints.reduce((nearest, point) => {
    const distance = Math.hypot(point.x - pointerX, point.y - pointerY);
    return !nearest || distance < nearest.distance ? { point, distance } : nearest;
  }, null);

  if (nearestPoint && nearestPoint.distance <= 28) {
    selectChartPoint(nearestPoint.point.index);
  }
}

function handleChartKeydown(event) {
  if (!chartPoints.length) return;
  if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(event.key)) return;
  event.preventDefault();

  if (event.key === "Home") selectChartPoint(0);
  else if (event.key === "End") selectChartPoint(chartPoints.length - 1);
  else if (event.key === "ArrowLeft") {
    selectChartPoint(Math.max(0, selectedChartPoint < 0 ? 0 : selectedChartPoint - 1));
  } else if (event.key === "ArrowRight") {
    selectChartPoint(Math.min(
      chartPoints.length - 1,
      selectedChartPoint < 0 ? 0 : selectedChartPoint + 1,
    ));
  } else {
    selectChartPoint(selectedChartPoint < 0 ? 0 : selectedChartPoint);
  }
}

function renderClickAnalysis() {
  const durations = clickDurations.map((item) => item.duration);
  const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  const fastest = Math.min(...durations);
  const slowest = Math.max(...durations);

  averageClickTimeElement.textContent = formatDuration(average);
  fastestClickTimeElement.textContent = formatDuration(fastest);
  slowestClickTimeElement.textContent = formatDuration(slowest);
  clickTimeList.replaceChildren();

  const fragment = document.createDocumentFragment();
  clickDurations.forEach((item) => {
    const entry = document.createElement("div");
    entry.className = "click-time-entry";
    entry.innerHTML = `<span>寻找 ${item.number}</span><strong>${formatDuration(item.duration)}</strong>`;
    fragment.appendChild(entry);
  });
  clickTimeList.appendChild(fragment);
  selectedChartPoint = -1;
  clickTimeTooltip.hidden = true;
  requestAnimationFrame(drawClickTimeChart);
}

function finishGame(now = performance.now()) {
  elapsedTime = now - startTime;
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
  renderClickAnalysis();
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
    if (state === "running") hintElement.textContent = getRunningHint();
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

  const clickTime = performance.now();
  if (expectedNumber === 1) {
    startTimer(clickTime);
  } else {
    clickDurations.push({
      number: value,
      duration: clickTime - lastCorrectClickTime,
    });
    lastCorrectClickTime = clickTime;
  }
  tile.classList.add("done");
  tile.disabled = true;
  expectedNumber += 1;
  progressBar.style.width = `${((expectedNumber - 1) / totalNumbers) * 100}%`;

  if (expectedNumber === totalNumbers + 1) {
    finishGame(clickTime);
  } else {
    nextNumberElement.textContent = expectedNumber;
    if (ultimateTrial) {
      renderBoard();
      hintElement.textContent = getRunningHint();
    }
  }
}

function renderBoard() {
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
    if (number < expectedNumber) {
      tile.classList.add("done");
      tile.disabled = true;
    }
    tile.addEventListener("click", handleTileClick);
    fragment.appendChild(tile);
  });
  board.appendChild(fragment);

  if (ultimateTrial && expectedNumber > 1) {
    board.classList.remove("refreshing");
    void board.offsetWidth;
    board.classList.add("refreshing");
  }
}

function newGame() {
  cancelAnimationFrame(timerFrame);
  expectedNumber = 1;
  startTime = 0;
  elapsedTime = 0;
  lastCorrectClickTime = 0;
  clickDurations = [];
  chartPoints = [];
  selectedChartPoint = -1;
  clickTimeTooltip.hidden = true;
  state = "ready";
  timerElement.textContent = "00:00.00";
  nextNumberElement.textContent = "1";
  hintElement.textContent = ultimateTrial
    ? "点击数字 1；每次选对后棋盘都会刷新"
    : "点击数字 1，计时开始";
  hintElement.classList.remove("error");
  progressBar.style.width = "0%";
  completionCard.classList.remove("show");
  completionCard.setAttribute("aria-hidden", "true");

  gameTitle.textContent = `顺序 ${totalNumbers}`;
  const colorDescription = colorMode === "same" ? "同色棋盘" : "多色棋盘";
  const trialDescription = ultimateTrial ? " · 终极试炼" : "";
  gameSubtitle.textContent = `从 1 开始，按顺序点到 ${totalNumbers} · ${colorDescription}${trialDescription}`;
  maxNumberElement.textContent = totalNumbers;
  renderBoard();
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
  const colorDescription = mode === "same" ? "同色棋盘" : "多色棋盘";
  selectedModeSummary.textContent = `已选择 ${gridSize} × ${gridSize} · ${colorDescription}`;
  setupScreen.setAttribute("aria-labelledby", "challengeTitle");
  colorStep.hidden = true;
  challengeStep.hidden = false;
  trialModeButtons[0].focus();
}

function selectTrialMode(isUltimate) {
  ultimateTrial = isUltimate;
  setupScreen.hidden = true;
  newGame();
}

function showSizeStep() {
  setupScreen.setAttribute("aria-labelledby", "setupTitle");
  colorStep.hidden = true;
  challengeStep.hidden = true;
  sizeStep.hidden = false;
  setupScreen.querySelector(`[data-size="${gridSize}"]`).focus();
}

function showColorStep() {
  setupScreen.setAttribute("aria-labelledby", "colorTitle");
  sizeStep.hidden = true;
  challengeStep.hidden = true;
  colorStep.hidden = false;
  const selectedButton = setupScreen.querySelector(`[data-color-mode="${colorMode}"]`);
  (selectedButton || colorModeButtons[0]).focus();
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
trialModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectTrialMode(button.dataset.ultimateTrial === "true");
  });
});
backToSizeButton.addEventListener("click", showSizeStep);
backToColorButton.addEventListener("click", showColorStep);
restartButton.addEventListener("click", newGame);
playAgainButton.addEventListener("click", newGame);
changeSizeButton.addEventListener("click", openSizePicker);
clickTimeChart.addEventListener("click", handleChartClick);
clickTimeChart.addEventListener("keydown", handleChartKeydown);
window.addEventListener("resize", () => {
  if (state === "complete") drawClickTimeChart();
});
