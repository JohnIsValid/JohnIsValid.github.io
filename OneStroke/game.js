const board = document.querySelector("#board");
const canvas = document.querySelector("#trailCanvas");
const context = canvas.getContext("2d");
const dotLayer = document.querySelector("#dotLayer");
const progressText = document.querySelector("#progressText");
const hint = document.querySelector("#hint");
const resetButton = document.querySelector("#resetButton");
const levelPickerButton = document.querySelector("#levelPickerButton");
const currentLevelName = document.querySelector("#currentLevelName");
const completionCard = document.querySelector("#completionCard");
const nextLevelNote = document.querySelector("#nextLevelNote");
const levelPicker = document.querySelector("#levelPicker");
const closeLevelPickerButton = document.querySelector("#closeLevelPickerButton");
const levelCount = document.querySelector("#levelCount");
const levelOptions = document.querySelector("#levelOptions");

const GRID_SIZE = 10;
const BOARD_PADDING_RATIO = 0.09;
const POINT_CHARACTERS = {
  "1": { kind: "normal", color: "normal", value: 1 },
  "2": { kind: "color", color: "red", value: 2 },
  "3": { kind: "color", color: "yellow", value: 3 },
  "4": { kind: "color", color: "purple", value: 4 },
};

let levels = [];
let pointColors = {};
let currentLevelIndex = 0;
let activePoints = [];
let pointTypes = new Map();
let committedPaths = [];
let usedPoints = new Set();
let currentPath = [];
let currentComponent = new Set();
let isDrawing = false;
let pointerId = null;
let lastPointer = null;
let isComplete = false;
let levelHasColors = false;
let autoAdvanceTimer = null;

function getAdjacentPointIndexes(pointIndex, size) {
  const row = Math.floor(pointIndex / size);
  const column = pointIndex % size;
  const adjacentPoints = [];
  if (row > 0) adjacentPoints.push(pointIndex - size);
  if (row < size - 1) adjacentPoints.push(pointIndex + size);
  if (column > 0) adjacentPoints.push(pointIndex - 1);
  if (column < size - 1) adjacentPoints.push(pointIndex + 1);
  return adjacentPoints;
}

function getConnectedPointCount(points) {
  if (!points.length) return 0;
  const pointSet = new Set(points);
  const connectedPoints = new Set([points[0]]);
  const queue = [points[0]];
  while (queue.length) {
    getAdjacentPointIndexes(queue.shift(), GRID_SIZE).forEach((neighbor) => {
      if (pointSet.has(neighbor) && !connectedPoints.has(neighbor)) {
        connectedPoints.add(neighbor);
        queue.push(neighbor);
      }
    });
  }
  return connectedPoints.size;
}

function getConnectedComponents(points) {
  const pointSet = new Set(points);
  const unseenPoints = new Set(points);
  const components = [];

  while (unseenPoints.size) {
    const startPoint = unseenPoints.values().next().value;
    const component = [];
    const queue = [startPoint];
    unseenPoints.delete(startPoint);

    while (queue.length) {
      const pointIndex = queue.shift();
      component.push(pointIndex);
      getAdjacentPointIndexes(pointIndex, GRID_SIZE).forEach((neighbor) => {
        if (pointSet.has(neighbor) && unseenPoints.has(neighbor)) {
          unseenPoints.delete(neighbor);
          queue.push(neighbor);
        }
      });
    }
    components.push(component);
  }

  return components;
}

function parseLevel(level, levelIndex) {
  const levelName = level?.name || `第 ${levelIndex + 1} 关`;
  if (!Array.isArray(level?.map) || level.map.length !== GRID_SIZE) {
    throw new Error(`${levelName}：map 必须包含 ${GRID_SIZE} 行`);
  }

  const points = [];
  const types = {};
  const colorCounts = { red: 0, yellow: 0, purple: 0 };

  level.map.forEach((row, rowIndex) => {
    if (typeof row !== "string" || row.length !== GRID_SIZE) {
      throw new Error(`${levelName}：第 ${rowIndex + 1} 行必须有 ${GRID_SIZE} 个字符`);
    }
    if (!/^[01234]+$/.test(row)) {
      throw new Error(`${levelName}：只能使用 0、1、2、3、4`);
    }

    [...row].forEach((cell, columnIndex) => {
      if (cell === "0") return;
      const pointIndex = rowIndex * GRID_SIZE + columnIndex;
      const type = POINT_CHARACTERS[cell];
      points.push(pointIndex);
      types[pointIndex] = type;
      if (type.kind === "color") colorCounts[type.color] += 1;
    });
  });

  if (points.length < 2) {
    throw new Error(`${levelName}：至少需要两个参与玩法的点`);
  }

  Object.entries(colorCounts).forEach(([color, count]) => {
    if (count % 2 !== 0) {
      const colorName = { red: "红色", yellow: "黄色", purple: "紫色" }[color];
      throw new Error(`${levelName}：${colorName}点数量必须为偶数`);
    }
  });

  const pointSet = new Set(points);
  const isolatedPoint = points.find(
    (pointIndex) => !getAdjacentPointIndexes(pointIndex, GRID_SIZE).some((neighbor) => pointSet.has(neighbor)),
  );
  if (isolatedPoint !== undefined) {
    throw new Error(`${levelName}：存在没有上下左右相邻点的孤立点`);
  }

  const totalColorPoints = Object.values(colorCounts).reduce((total, count) => total + count, 0);
  if (totalColorPoints === 0 && getConnectedPointCount(points) !== points.length) {
    throw new Error(`${levelName}：无颜色关卡的所有普通点必须上下左右连通`);
  }
  if (totalColorPoints > 0) {
    getConnectedComponents(points).forEach((component, componentIndex) => {
      const componentColorCounts = { red: 0, yellow: 0, purple: 0 };
      component.forEach((pointIndex) => {
        const type = types[pointIndex];
        if (type.kind === "color") componentColorCounts[type.color] += 1;
      });
      Object.entries(componentColorCounts).forEach(([color, count]) => {
        if (count % 2 !== 0) {
          const colorName = { red: "红色", yellow: "黄色", purple: "紫色" }[color];
          throw new Error(`${levelName}：第 ${componentIndex + 1} 个连通区域的${colorName}点数量必须为偶数`);
        }
      });
    });
  }

  return { name: levelName, points, types, colorCounts };
}

function parsePointColors() {
  const colorConfig = window.ONE_STROKE_POINT_COLORS;
  if (!colorConfig || typeof colorConfig !== "object") {
    throw new Error("未找到数字对应的点颜色配置");
  }

  const parsedColors = {};
  for (let value = 0; value <= 4; value += 1) {
    const color = colorConfig[value];
    if (typeof color !== "string" || !color.trim()) {
      throw new Error(`点颜色配置缺少数字 ${value}`);
    }
    parsedColors[value] = color;
  }
  return parsedColors;
}

function getPointPosition(pointIndex, boardSize) {
  const row = Math.floor(pointIndex / GRID_SIZE);
  const column = pointIndex % GRID_SIZE;
  const padding = boardSize * BOARD_PADDING_RATIO;
  const availableSize = boardSize - padding * 2;
  return {
    x: padding + (column / (GRID_SIZE - 1)) * availableSize,
    y: padding + (row / (GRID_SIZE - 1)) * availableSize,
  };
}

function getEventPosition(event) {
  const rect = board.getBoundingClientRect();
  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
  };
}

function getHitRadius() {
  return Math.max(14, board.clientWidth / (GRID_SIZE * 2.7));
}

function getDistanceToSegment(point, start, end) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const progress = lengthSquared === 0
    ? 0
    : Math.min(
      Math.max(((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared, 0),
      1,
    );
  const closestX = start.x + deltaX * progress;
  const closestY = start.y + deltaY * progress;
  return {
    distance: Math.hypot(point.x - closestX, point.y - closestY),
    progress,
  };
}

function resizeCanvas() {
  const size = board.clientWidth;
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * pixelRatio);
  canvas.height = Math.round(size * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawTrails();
}

function drawPath(points, colorValue, boardSize) {
  if (points.length < 2) return;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(4, boardSize / 115);
  context.strokeStyle = pointColors[colorValue] || pointColors[1];
  context.shadowColor = context.strokeStyle;
  context.shadowBlur = 14;
  context.beginPath();
  points.forEach((pointIndex, index) => {
    const position = getPointPosition(pointIndex, boardSize);
    if (index === 0) context.moveTo(position.x, position.y);
    else context.lineTo(position.x, position.y);
  });
  context.stroke();
  context.restore();
}

function getPathColor(path) {
  const colorValues = [...new Set(
    path
      .map((pointIndex) => pointTypes.get(pointIndex))
      .filter((type) => type?.kind === "color")
      .map((type) => type.value),
  )];
  return colorValues.length === 1 ? colorValues[0] : 1;
}

function drawTrails() {
  const size = board.clientWidth;
  context.clearRect(0, 0, size, size);
  committedPaths.forEach((path) => drawPath(path, getPathColor(path), size));
  drawPath(currentPath, getPathColor(currentPath), size);
}

function getCoveredPoints() {
  return new Set([...usedPoints, ...currentPath]);
}

function updateDots() {
  const currentSet = new Set(currentPath);
  dotLayer.querySelectorAll(".game-dot").forEach((dot) => {
    const pointIndex = Number(dot.dataset.point);
    dot.classList.toggle("used", usedPoints.has(pointIndex));
    dot.classList.toggle("current", currentSet.has(pointIndex));
  });
}

function updateProgress() {
  progressText.textContent = `${getCoveredPoints().size} / ${activePoints.length}`;
}

function clearCurrentStroke(message) {
  isDrawing = false;
  pointerId = null;
  lastPointer = null;
  currentPath = [];
  currentComponent = new Set();
  board.classList.remove("is-drawing");
  hint.classList.remove("error");
  if (message) hint.textContent = message;
  updateDots();
  updateProgress();
  drawTrails();
}

function failCurrentStroke(message) {
  clearCurrentStroke(message);
  hint.classList.add("error");
}

function resetLevelProgress(message = "从任意未完成区域开始，一笔连接该区域的全部点") {
  committedPaths = [];
  usedPoints = new Set();
  clearCurrentStroke(levelHasColors ? message : "按住任意普通点开始");
}

function renderPoints() {
  const fragment = document.createDocumentFragment();
  activePoints.forEach((pointIndex) => {
    const row = Math.floor(pointIndex / GRID_SIZE);
    const column = pointIndex % GRID_SIZE;
    const type = pointTypes.get(pointIndex);
    const dot = document.createElement("span");
    dot.className = `game-dot ${type.kind === "color" ? "color-point" : "normal-point"}`;
    dot.dataset.point = pointIndex;
    dot.style.setProperty("--point-color", pointColors[type.value]);
    dot.style.left = `${BOARD_PADDING_RATIO * 100 + (column / (GRID_SIZE - 1)) * (100 - BOARD_PADDING_RATIO * 200)}%`;
    dot.style.top = `${BOARD_PADDING_RATIO * 100 + (row / (GRID_SIZE - 1)) * (100 - BOARD_PADDING_RATIO * 200)}%`;
    fragment.appendChild(dot);
  });
  dotLayer.replaceChildren(fragment);
}

function clearAutoAdvance() {
  window.clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = null;
}

function closeLevelPicker() {
  levelPicker.hidden = true;
  if (isComplete) {
    clearAutoAdvance();
    autoAdvanceTimer = window.setTimeout(loadNextLevel, 600);
  }
}

function openLevelPicker() {
  if (!levels.length) return;
  clearAutoAdvance();
  levelPicker.hidden = false;
  const currentButton = levelOptions.querySelector(`[data-level-index="${currentLevelIndex}"]`);
  currentButton?.focus({ preventScroll: true });
}

function updateLevelPickerState() {
  levelOptions.querySelectorAll("[data-level-index]").forEach((button) => {
    const isCurrent = Number(button.dataset.levelIndex) === currentLevelIndex;
    button.classList.toggle("current", isCurrent);
    button.setAttribute("aria-current", isCurrent ? "true" : "false");
  });
}

function loadLevel(levelIndex) {
  if (!levels.length) return;
  clearAutoAdvance();
  currentLevelIndex = (levelIndex + levels.length) % levels.length;
  const level = levels[currentLevelIndex];
  activePoints = [...level.points];
  pointTypes = new Map(level.points.map((pointIndex) => [pointIndex, level.types[pointIndex]]));
  levelHasColors = Object.values(level.colorCounts).some((count) => count > 0);
  isComplete = false;
  levelPicker.hidden = true;
  currentLevelName.textContent = `${currentLevelIndex + 1} / ${levels.length} · ${level.name}`;
  completionCard.classList.remove("show");
  completionCard.setAttribute("aria-hidden", "true");
  board.setAttribute(
    "aria-label",
    `10乘10一笔画棋盘，${level.name}，只能上下左右连接相邻点`,
  );
  updateLevelPickerState();
  renderPoints();
  resetLevelProgress();
  resizeCanvas();
}

function loadNextLevel() {
  loadLevel(currentLevelIndex + 1);
}

function setupLevels() {
  try {
    const levelConfigs = window.ONE_STROKE_LEVELS;
    if (!Array.isArray(levelConfigs) || !levelConfigs.length) {
      throw new Error("未找到关卡配置");
    }
    pointColors = parsePointColors();
    levels = levelConfigs.map(parseLevel);
    levelCount.textContent = `共 ${levels.length} 个关卡`;
    levelOptions.replaceChildren(
      ...levels.map((level, index) => {
        const button = document.createElement("button");
        const number = document.createElement("span");
        const name = document.createElement("strong");
        button.type = "button";
        button.dataset.levelIndex = String(index);
        number.textContent = String(index + 1).padStart(2, "0");
        name.textContent = level.name;
        button.append(number, name);
        button.addEventListener("click", () => loadLevel(index));
        return button;
      }),
    );
    loadLevel(0);
  } catch (error) {
    console.error(error);
    hint.classList.add("error");
    hint.textContent = `关卡配置错误：${error.message}`;
    progressText.textContent = "0 / 0";
    resetButton.disabled = true;
    levelPickerButton.disabled = true;
  }
}

function restartCurrentRound() {
  clearAutoAdvance();
  isComplete = false;
  completionCard.classList.remove("show");
  completionCard.setAttribute("aria-hidden", "true");
  resetLevelProgress();
}

function findStartingPoint(position) {
  const boardSize = board.clientWidth;
  const hitRadius = getHitRadius();
  return activePoints.find((pointIndex) => {
    const pointPosition = getPointPosition(pointIndex, boardSize);
    return Math.hypot(position.x - pointPosition.x, position.y - pointPosition.y) <= hitRadius;
  });
}

function getRemainingComponent(startPoint) {
  const availablePoints = new Set(activePoints.filter((pointIndex) => !usedPoints.has(pointIndex)));
  const component = new Set([startPoint]);
  const queue = [startPoint];

  while (queue.length) {
    getAdjacentPointIndexes(queue.shift(), GRID_SIZE).forEach((neighbor) => {
      if (availablePoints.has(neighbor) && !component.has(neighbor)) {
        component.add(neighbor);
        queue.push(neighbor);
      }
    });
  }
  return component;
}

function componentHasColorPoints(component) {
  return [...component].some((pointIndex) => pointTypes.get(pointIndex)?.kind === "color");
}

function hasMatchingColorEndpoints(path) {
  const startType = pointTypes.get(path[0]);
  const endType = pointTypes.get(path.at(-1));
  return startType?.kind === "color"
    && endType?.kind === "color"
    && startType.color === endType.color
    && path[0] !== path.at(-1);
}

function takeCompletedColorPath(pointIndex) {
  const pathIndex = committedPaths.findIndex((path) => (
    hasMatchingColorEndpoints(path)
    && (path[0] === pointIndex || path.at(-1) === pointIndex)
  ));
  if (pathIndex < 0) return null;

  const [path] = committedPaths.splice(pathIndex, 1);
  path.forEach((pathPoint) => usedPoints.delete(pathPoint));
  return path.at(-1) === pointIndex ? [...path] : [...path].reverse();
}

function addAdjacentPoints(start, end) {
  const boardSize = board.clientWidth;
  const hitRadius = getHitRadius();
  const crossedPoints = activePoints
    .map((pointIndex) => {
      const pointPosition = getPointPosition(pointIndex, boardSize);
      const result = getDistanceToSegment(pointPosition, start, end);
      return { pointIndex, ...result };
    })
    .filter((result) => result.distance <= hitRadius)
    .sort((first, second) => first.progress - second.progress);

  let changedPath = false;
  let blockedReason = "";

  for (const { pointIndex } of crossedPoints) {
    const currentPoint = currentPath.at(-1);
    if (pointIndex === currentPoint) continue;
    if (!getAdjacentPointIndexes(currentPoint, GRID_SIZE).includes(pointIndex)) {
      blockedReason = "只能连接上下左右相邻的点";
      continue;
    }

    const previousPoint = currentPath.at(-2);
    if (pointIndex === previousPoint) {
      currentPath.pop();
      changedPath = true;
      continue;
    }

    if (currentPath.includes(pointIndex)) {
      blockedReason = "当前线路不能重复经过同一个点";
      continue;
    }
    if (usedPoints.has(pointIndex)) {
      blockedReason = "这个点属于已经完成的线路";
      continue;
    }

    currentPath.push(pointIndex);
    changedPath = true;
  }

  if (changedPath) {
    updateDots();
    updateProgress();
    hint.classList.remove("error");
    const startType = pointTypes.get(currentPath[0]);
    hint.textContent = startType?.kind === "color"
      ? "继续连接到另一个同色点，松手后将保留这条线路"
      : `继续连接，本区域还剩 ${currentComponent.size - currentPath.length} 个点`;
  } else if (blockedReason) {
    hint.classList.add("error");
    hint.textContent = blockedReason;
  }
}

function finishRound() {
  isDrawing = false;
  pointerId = null;
  lastPointer = null;
  isComplete = true;
  board.classList.remove("is-drawing");
  hint.classList.remove("error");
  hint.textContent = "完成！所有点和同色端点均已连接";
  drawTrails();
  completionCard.classList.add("show");
  completionCard.setAttribute("aria-hidden", "false");
  nextLevelNote.textContent = currentLevelIndex === levels.length - 1
    ? "全部关卡完成，即将返回第一关"
    : `即将进入第 ${currentLevelIndex + 2} 关`;
  autoAdvanceTimer = window.setTimeout(loadNextLevel, 1200);
}

function commitCurrentStroke() {
  committedPaths.push([...currentPath]);
  currentPath.forEach((pointIndex) => usedPoints.add(pointIndex));
  clearCurrentStroke();

  if (usedPoints.size === activePoints.length) {
    finishRound();
  } else {
    hint.textContent = `本条线路完成，还剩 ${activePoints.length - usedPoints.size} 个点`;
  }
}

board.addEventListener("pointerdown", (event) => {
  if (isComplete || isDrawing || (event.pointerType === "mouse" && event.button !== 0)) return;
  const position = getEventPosition(event);
  const startingPoint = findStartingPoint(position);
  if (startingPoint === undefined) {
    hint.classList.add("error");
    hint.textContent = "请从参与玩法的点开始";
    return;
  }
  let resumedColorPath = null;
  if (usedPoints.has(startingPoint)) {
    resumedColorPath = takeCompletedColorPath(startingPoint);
    if (!resumedColorPath) {
      hint.classList.add("error");
      hint.textContent = "这个点属于已经完成的普通线路";
      return;
    }
  }
  event.preventDefault();
  pointerId = event.pointerId;
  board.setPointerCapture(pointerId);
  isDrawing = true;
  currentPath = resumedColorPath || [startingPoint];
  currentComponent = getRemainingComponent(startingPoint);
  lastPointer = position;
  board.classList.add("is-drawing");
  hint.classList.remove("error");
  hint.textContent = resumedColorPath
    ? "已重新拿起颜色线路，沿原路线反向拖动即可回退"
    : pointTypes.get(startingPoint)?.kind === "color"
      ? "从颜色点起笔，请连接到另一个同色点"
      : `本笔需要连接当前区域的全部 ${currentComponent.size} 个点`;
  updateDots();
  updateProgress();
  drawTrails();
});

board.addEventListener("pointermove", (event) => {
  if (!isDrawing || event.pointerId !== pointerId) return;
  event.preventDefault();
  const position = getEventPosition(event);
  addAdjacentPoints(lastPointer, position);
  lastPointer = position;
  drawTrails();
});

board.addEventListener("pointerup", (event) => {
  if (!isDrawing || event.pointerId !== pointerId) return;
  const position = getEventPosition(event);
  addAdjacentPoints(lastPointer, position);

  const startsAtColorPoint = pointTypes.get(currentPath[0])?.kind === "color";
  if (startsAtColorPoint) {
    if (!hasMatchingColorEndpoints(currentPath)) {
      failCurrentStroke("线路失败：从颜色点起笔时，必须在另一个同色点结束");
      return;
    }

    commitCurrentStroke();
    return;
  }

  if (new Set(currentPath).size !== currentComponent.size) {
    failCurrentStroke(`本条线路还有 ${currentComponent.size - new Set(currentPath).size} 个点未经过`);
    return;
  }

  if (componentHasColorPoints(currentComponent) && !hasMatchingColorEndpoints(currentPath)) {
    failCurrentStroke("线路失败：有颜色点的区域必须从同色点开始并在同色点结束");
    return;
  }

  commitCurrentStroke();
});

board.addEventListener("pointercancel", () => {
  if (isDrawing) clearCurrentStroke("线路中断，请重新画这一笔");
});

resetButton.addEventListener("click", restartCurrentRound);
levelPickerButton.addEventListener("click", openLevelPicker);
closeLevelPickerButton.addEventListener("click", closeLevelPicker);
levelPicker.addEventListener("click", (event) => {
  if (event.target === levelPicker) closeLevelPicker();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !levelPicker.hidden) closeLevelPicker();
});
window.addEventListener("resize", resizeCanvas);

setupLevels();
