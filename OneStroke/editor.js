const GRID_SIZE = 10;
const board = document.querySelector("#editorBoard");
const pathCanvas = document.querySelector("#pathCanvas");
const pathContext = pathCanvas.getContext("2d");
const palette = document.querySelector("#palette");
const levelNameInput = document.querySelector("#levelName");
const pointSummary = document.querySelector("#pointSummary");
const validationMessage = document.querySelector("#validationMessage");
const clearButton = document.querySelector("#clearButton");
const copyButton = document.querySelector("#copyButton");
const dataPreview = document.querySelector("#dataPreview");
const copyStatus = document.querySelector("#copyStatus");
const sourceLevelList = document.querySelector("#sourceLevelList");
const sourceLevelCount = document.querySelector("#sourceLevelCount");
const newLevelButton = document.querySelector("#newLevelButton");
const clearPathButton = document.querySelector("#clearPathButton");

const cells = Array(GRID_SIZE * GRID_SIZE).fill("0");
const pathEdges = new Set();
const sourceLevels = Array.isArray(window.ONE_STROKE_LEVELS) ? window.ONE_STROKE_LEVELS : [];
let selectedValue = "1";
let isPainting = false;
let lastPaintedIndex = -1;
let currentSourceIndex = -1;

function getLevelName() {
  return levelNameInput.value.trim() || "未命名关卡";
}

function getMapRows() {
  return Array.from(
    { length: GRID_SIZE },
    (_, rowIndex) => cells.slice(rowIndex * GRID_SIZE, (rowIndex + 1) * GRID_SIZE).join(""),
  );
}

function buildExportData() {
  const escapedName = getLevelName()
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", " ");
  const mapLines = getMapRows().map((row) => `    "${row}",`).join("\n");
  return `{\n  name: "${escapedName}",\n  map: [\n${mapLines}\n  ],\n},`;
}

function getCounts() {
  return cells.reduce(
    (counts, value) => {
      counts[value] += 1;
      return counts;
    },
    { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
  );
}

function updateOutput() {
  const counts = getCounts();
  pointSummary.textContent = `普通 ${counts[1]} · 红 ${counts[2]} · 黄 ${counts[3]} · 紫 ${counts[4]} · 路径 ${pathEdges.size} 段`;
  dataPreview.value = buildExportData();

  const activeCount = cells.length - counts[0];
  const oddColors = [
    ["红色", counts[2]],
    ["黄色", counts[3]],
    ["紫色", counts[4]],
  ].filter(([, count]) => count % 2 !== 0);

  validationMessage.className = "";
  if (activeCount < 2) {
    validationMessage.textContent = "至少需要绘制两个参与玩法的点";
    validationMessage.classList.add("error");
  } else if (oddColors.length) {
    validationMessage.textContent = `${oddColors.map(([name]) => name).join("、")}点数量不是偶数`;
    validationMessage.classList.add("error");
  } else {
    validationMessage.textContent = "基础数量检查通过，可以导出";
    validationMessage.classList.add("valid");
  }
}

function updateCell(index) {
  const cell = board.children[index];
  cell.dataset.value = cells[index];
  const typeNames = {
    0: "隐藏点",
    1: "普通点",
    2: "红色点",
    3: "黄色点",
    4: "紫色点",
  };
  cell.setAttribute("aria-label", `第 ${Math.floor(index / GRID_SIZE) + 1} 行第 ${index % GRID_SIZE + 1} 列，${typeNames[cells[index]]}`);
}

function updateAllCells() {
  cells.forEach((_, index) => updateCell(index));
  updateConnections();
}

function updateConnections() {
  const size = board.clientWidth;
  const pixelRatio = window.devicePixelRatio || 1;
  const canvasSize = Math.round(size * pixelRatio);
  if (pathCanvas.width !== canvasSize || pathCanvas.height !== canvasSize) {
    pathCanvas.width = canvasSize;
    pathCanvas.height = canvasSize;
  }

  pathContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  pathContext.clearRect(0, 0, size, size);
  if (!pathEdges.size || !size) return;

  const cellSize = size / GRID_SIZE;
  pathContext.lineCap = "round";
  pathContext.lineJoin = "round";

  const drawEdges = (lineWidth, strokeStyle, shadowBlur = 0) => {
    pathContext.beginPath();
    pathEdges.forEach((edge) => {
      const [firstIndex, secondIndex] = edge.split("-").map(Number);
      const firstX = (firstIndex % GRID_SIZE + 0.5) * cellSize;
      const firstY = (Math.floor(firstIndex / GRID_SIZE) + 0.5) * cellSize;
      const secondX = (secondIndex % GRID_SIZE + 0.5) * cellSize;
      const secondY = (Math.floor(secondIndex / GRID_SIZE) + 0.5) * cellSize;
      pathContext.moveTo(firstX, firstY);
      pathContext.lineTo(secondX, secondY);
    });
    pathContext.lineWidth = lineWidth;
    pathContext.strokeStyle = strokeStyle;
    pathContext.shadowColor = "#8dffad";
    pathContext.shadowBlur = shadowBlur;
    pathContext.stroke();
  };

  drawEdges(10, "rgba(34, 217, 110, 0.2)", 12);
  drawEdges(5, "#8dffad", 8);
  pathContext.shadowBlur = 0;
}

function getEdgeKey(firstIndex, secondIndex) {
  return firstIndex < secondIndex
    ? `${firstIndex}-${secondIndex}`
    : `${secondIndex}-${firstIndex}`;
}

function areAdjacent(firstIndex, secondIndex) {
  const firstRow = Math.floor(firstIndex / GRID_SIZE);
  const firstColumn = firstIndex % GRID_SIZE;
  const secondRow = Math.floor(secondIndex / GRID_SIZE);
  const secondColumn = secondIndex % GRID_SIZE;
  return Math.abs(firstRow - secondRow) + Math.abs(firstColumn - secondColumn) === 1;
}

function removePathEdgesForPoint(pointIndex) {
  [...pathEdges].forEach((edge) => {
    const [firstIndex, secondIndex] = edge.split("-").map(Number);
    if (firstIndex === pointIndex || secondIndex === pointIndex) pathEdges.delete(edge);
  });
}

function paintCell(index) {
  if (index < 0 || index >= cells.length || index === lastPaintedIndex) return;
  let invalidConnection = false;

  if (selectedValue !== "0" && lastPaintedIndex >= 0) {
    if (areAdjacent(lastPaintedIndex, index)) {
      pathEdges.add(getEdgeKey(lastPaintedIndex, index));
    } else {
      invalidConnection = true;
      copyStatus.textContent = "跨格或斜向移动不会生成连线";
      copyStatus.classList.add("error");
    }
  }

  if (selectedValue === "0") removePathEdgesForPoint(index);
  const isExistingColorPoint = ["2", "3", "4"].includes(cells[index]);
  if (!(selectedValue === "1" && isExistingColorPoint)) cells[index] = selectedValue;
  lastPaintedIndex = index;
  updateCell(index);
  updateConnections();
  updateOutput();
  if (!invalidConnection) {
    copyStatus.classList.remove("error");
    copyStatus.textContent = pathEdges.size ? "点位和规划路径已同步更新" : "";
  }
}

function paintToward(index) {
  if (lastPaintedIndex < 0 || areAdjacent(lastPaintedIndex, index)) {
    paintCell(index);
    return;
  }

  const startIndex = lastPaintedIndex;
  const startRow = Math.floor(startIndex / GRID_SIZE);
  const startColumn = startIndex % GRID_SIZE;
  const endRow = Math.floor(index / GRID_SIZE);
  const endColumn = index % GRID_SIZE;

  if (startRow === endRow) {
    const step = endColumn > startColumn ? 1 : -1;
    for (let column = startColumn + step; column !== endColumn + step; column += step) {
      paintCell(startRow * GRID_SIZE + column);
    }
    return;
  }

  if (startColumn === endColumn) {
    const step = endRow > startRow ? 1 : -1;
    for (let row = startRow + step; row !== endRow + step; row += step) {
      paintCell(row * GRID_SIZE + startColumn);
    }
    return;
  }

  paintCell(index);
}

function setActiveSourceLevel() {
  sourceLevelList.querySelectorAll(".source-level").forEach((option) => {
    option.classList.toggle("active", Number(option.dataset.levelIndex) === currentSourceIndex);
  });
}

function loadSourceLevel(levelIndex) {
  const level = sourceLevels[levelIndex];
  if (!level || !Array.isArray(level.map) || level.map.length !== GRID_SIZE) return;
  const values = level.map.join("").split("");
  if (values.length !== cells.length || values.some((value) => !/^[0-4]$/.test(value))) return;

  cells.splice(0, cells.length, ...values);
  pathEdges.clear();
  currentSourceIndex = levelIndex;
  levelNameInput.value = level.name || `第 ${levelIndex + 1} 关`;
  updateAllCells();
  updateOutput();
  setActiveSourceLevel();
  copyStatus.classList.remove("error");
  copyStatus.textContent = `已载入第 ${levelIndex + 1} 关，按住拖动即可同时绘制点和路径`;
}

function createLevelThumbnail(map) {
  const thumbnail = document.createElement("span");
  thumbnail.className = "level-thumbnail";
  const values = Array.isArray(map) ? map.join("").split("").slice(0, cells.length) : [];
  while (values.length < cells.length) values.push("0");
  values.forEach((value) => {
    const point = document.createElement("i");
    point.className = "thumbnail-cell";
    point.dataset.value = value;
    thumbnail.appendChild(point);
  });
  return thumbnail;
}

function renderSourceLevels() {
  sourceLevelCount.textContent = `levels.js · 共 ${sourceLevels.length} 关`;
  if (!sourceLevels.length) {
    sourceLevelList.textContent = "没有读取到可用关卡";
    return;
  }

  const fragment = document.createDocumentFragment();
  sourceLevels.forEach((level, levelIndex) => {
    const option = document.createElement("button");
    option.className = "source-level";
    option.type = "button";
    option.dataset.levelIndex = levelIndex;
    option.appendChild(createLevelThumbnail(level.map));

    const copy = document.createElement("span");
    copy.className = "source-level-copy";
    const number = document.createElement("small");
    number.textContent = `LEVEL ${String(levelIndex + 1).padStart(2, "0")}`;
    const name = document.createElement("strong");
    name.textContent = level.name || `第 ${levelIndex + 1} 关`;
    copy.append(number, name);
    option.appendChild(copy);
    fragment.appendChild(option);
  });
  sourceLevelList.replaceChildren(fragment);
}

function selectValue(value) {
  if (!/^[0-4]$/.test(value)) return;
  selectedValue = value;
  palette.querySelectorAll(".palette-option").forEach((option) => {
    const isActive = option.dataset.value === value;
    option.classList.toggle("active", isActive);
    option.setAttribute("aria-checked", String(isActive));
  });
}

function getCellFromPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  return element?.closest(".grid-cell");
}

function endPainting() {
  isPainting = false;
  lastPaintedIndex = -1;
}

function createBoard() {
  const fragment = document.createDocumentFragment();
  cells.forEach((_, index) => {
    const cell = document.createElement("button");
    cell.className = "grid-cell";
    cell.type = "button";
    cell.role = "gridcell";
    cell.dataset.index = index;
    cell.dataset.value = "0";
    fragment.appendChild(cell);
  });
  board.appendChild(fragment);
  updateAllCells();
}

palette.addEventListener("click", (event) => {
  const option = event.target.closest(".palette-option");
  if (option) selectValue(option.dataset.value);
});

sourceLevelList.addEventListener("click", (event) => {
  const option = event.target.closest(".source-level");
  if (option) loadSourceLevel(Number(option.dataset.levelIndex));
});

board.addEventListener("pointerdown", (event) => {
  const cell = event.target.closest(".grid-cell");
  if (!cell || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  isPainting = true;
  paintCell(Number(cell.dataset.index));
});

board.addEventListener("pointermove", (event) => {
  if (!isPainting) return;
  event.preventDefault();
  const cell = getCellFromPoint(event.clientX, event.clientY);
  if (cell && board.contains(cell)) paintToward(Number(cell.dataset.index));
});

board.addEventListener("contextmenu", (event) => {
  const cell = event.target.closest(".grid-cell");
  if (!cell) return;
  event.preventDefault();
  const previousValue = selectedValue;
  selectedValue = "0";
  lastPaintedIndex = -1;
  paintCell(Number(cell.dataset.index));
  selectedValue = previousValue;
});

window.addEventListener("pointerup", endPainting);
window.addEventListener("pointercancel", endPainting);

window.addEventListener("keydown", (event) => {
  if (event.target.matches("input, textarea")) return;
  if (/^[0-4]$/.test(event.key)) selectValue(event.key);
});

levelNameInput.addEventListener("input", () => {
  updateOutput();
  copyStatus.textContent = "";
});

clearButton.addEventListener("click", () => {
  if (cells.some((value) => value !== "0") && !window.confirm("确定要清空当前棋盘吗？")) return;
  cells.fill("0");
  pathEdges.clear();
  updateAllCells();
  updateOutput();
  copyStatus.classList.remove("error");
  copyStatus.textContent = "棋盘已清空";
});

clearPathButton.addEventListener("click", () => {
  if (pathEdges.size && !window.confirm("确定要清除当前绘制的路径吗？")) return;
  pathEdges.clear();
  updateConnections();
  updateOutput();
  copyStatus.classList.remove("error");
  copyStatus.textContent = "路径已清除，点位保持不变";
});

newLevelButton.addEventListener("click", () => {
  if (cells.some((value) => value !== "0") && !window.confirm("确定要新建空白关卡吗？当前编辑内容不会被保存。")) return;
  cells.fill("0");
  pathEdges.clear();
  currentSourceIndex = -1;
  levelNameInput.value = "我的关卡";
  updateAllCells();
  updateOutput();
  setActiveSourceLevel();
  copyStatus.classList.remove("error");
  copyStatus.textContent = "已新建空白关卡";
});

copyButton.addEventListener("click", async () => {
  const exportData = buildExportData();
  copyStatus.classList.remove("error");

  try {
    await navigator.clipboard.writeText(exportData);
    copyStatus.textContent = "关卡数据已复制到剪贴板";
  } catch {
    dataPreview.focus();
    dataPreview.select();
    const copied = document.execCommand("copy");
    copyStatus.textContent = copied
      ? "关卡数据已复制到剪贴板"
      : "复制失败，请在下方数据框中手动复制";
    copyStatus.classList.toggle("error", !copied);
  }
});

createBoard();
renderSourceLevels();
if (sourceLevels.length) {
  loadSourceLevel(0);
} else {
  updateOutput();
}
window.addEventListener("resize", updateConnections);
