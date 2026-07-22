(() => {
  "use strict";

  const config = window.LINE_GARDEN_CONFIG;
  if (!config?.levels?.length) return;

  const canvas = document.getElementById("puzzleCanvas");
  const ctx = canvas.getContext("2d");
  const frame = document.getElementById("canvasFrame");
  const statusMessage = document.getElementById("statusMessage");
  const resultCard = document.getElementById("resultCard");
  const nextLevelButton = document.getElementById("nextLevelButton");
  const levelDots = document.getElementById("levelDots");
  const rulesDialog = document.getElementById("rulesDialog");
  let levelIndex = 0;
  let path = [];
  let drawing = false;
  let soundEnabled = true;
  let metrics = null;
  let completed = loadProgress();
  let audioContext = null;
  let missingCheckpoints = new Set();
  let checkpointFlashTimer = null;
  let retryTimer = null;

  const colors = {
    grid: "rgba(177, 217, 181, .33)",
    path: "#d0f5af",
    pathGlow: "rgba(159, 227, 157, .38)",
    start: "#9fe39d",
    gold: "#f7ca72",
    exit: "#e4f7d2",
    danger: "#ff4f58",
    teal: "#5bc2b1",
    coral: "#ee846f",
    lavender: "#c9a7ff",
    sky: "#86d8ff"
  };

  function loadProgress() {
    try { return new Set(JSON.parse(localStorage.getItem(config.game.storageKey) || "[]")); }
    catch { return new Set(); }
  }

  function saveProgress() {
    localStorage.setItem(config.game.storageKey, JSON.stringify([...completed]));
  }

  function currentLevel() { return config.levels[levelIndex]; }
  function key(point) { return `${point[0]},${point[1]}`; }
  function edgeKey(a, b) { return [key(a), key(b)].sort().join("|"); }
  function samePoint(a, b) { return a[0] === b[0] && a[1] === b[1]; }
  function adjacent(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1; }

  function setStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
  }

  function resizeCanvas() {
    const size = Math.max(280, Math.floor(frame.clientWidth));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const level = currentLevel();
    const padding = Math.max(42, size * .12);
    const available = size - padding * 2;
    const step = Math.min(available / level.cols, available / level.rows);
    const boardWidth = step * level.cols;
    const boardHeight = step * level.rows;
    metrics = {
      size,
      originX: (size - boardWidth) / 2,
      originY: (size - boardHeight) / 2,
      stepX: step,
      stepY: step
    };
    draw();
  }

  function position(point) {
    return {
      x: metrics.originX + point[0] * metrics.stepX,
      y: metrics.originY + point[1] * metrics.stepY
    };
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function draw() {
    if (!metrics) return;
    const level = currentLevel();
    ctx.clearRect(0, 0, metrics.size, metrics.size);
    drawGrid(level);
    drawSymbols(level);
    drawPath();
    drawStart(level);
    drawExit(level);
  }

  function drawGrid(level) {
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = Math.max(3, metrics.size * .006);
    ctx.lineCap = "round";
    for (let x = 0; x <= level.cols; x += 1) {
      const from = position([x, 0]);
      const to = position([x, level.rows]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    for (let y = 0; y <= level.rows; y += 1) {
      const from = position([0, y]);
      const to = position([level.cols, y]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSymbols(level) {
    drawBlockedEdges(level);

    (level.coloredCells || []).forEach((cell) => {
      const center = position([cell.x + .5, cell.y + .5]);
      const size = Math.min(metrics.stepX, metrics.stepY) * .25;
      ctx.save();
      ctx.fillStyle = colors[cell.color] || cell.color;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      roundedRect(center.x - size / 2, center.y - size / 2, size, size, size * .2);
      ctx.fill();
      ctx.restore();
    });

    (level.blossoms || []).forEach((blossom) => {
      const center = position([blossom.x + .5, blossom.y + .5]);
      const petalRadius = Math.min(metrics.stepX, metrics.stepY) * .075;
      const orbit = petalRadius * 1.22;
      ctx.save();
      ctx.fillStyle = colors[blossom.color] || blossom.color;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      for (let index = 0; index < 5; index += 1) {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
        ctx.beginPath();
        ctx.arc(center.x + Math.cos(angle) * orbit, center.y + Math.sin(angle) * orbit, petalRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(7, 22, 18, .84)";
      ctx.beginPath(); ctx.arc(center.x, center.y, petalRadius * .62, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    (level.triangles || []).forEach((triangle) => {
      const center = position([triangle.x + .5, triangle.y + .5]);
      const unit = Math.min(metrics.stepX, metrics.stepY) * .12;
      ctx.save();
      ctx.fillStyle = colors.gold;
      ctx.shadowColor = "rgba(247, 202, 114, .35)";
      ctx.shadowBlur = 8;
      for (let index = 0; index < triangle.count; index += 1) {
        const offset = (index - (triangle.count - 1) / 2) * unit * 1.15;
        ctx.beginPath();
        ctx.moveTo(center.x + offset, center.y - unit * .65);
        ctx.lineTo(center.x + offset - unit * .48, center.y + unit * .45);
        ctx.lineTo(center.x + offset + unit * .48, center.y + unit * .45);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });

    (level.checkpoints || []).forEach((checkpoint) => {
      const p = position(checkpoint);
      const isMissing = missingCheckpoints.has(key(checkpoint));
      const radius = Math.max(isMissing ? 8 : 5, metrics.size * (isMissing ? .015 : .01));
      ctx.save();
      ctx.fillStyle = isMissing ? colors.danger : colors.gold;
      ctx.shadowColor = isMissing ? colors.danger : colors.gold;
      ctx.shadowBlur = isMissing ? 26 : 13;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
      if (isMissing) {
        ctx.strokeStyle = "rgba(255, 79, 88, .7)";
        ctx.lineWidth = Math.max(2, metrics.size * .004);
        ctx.beginPath(); ctx.arc(p.x, p.y, radius * 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawBlockedEdges(level) {
    (level.blockedEdges || []).forEach(([first, second]) => {
      const a = position(first);
      const b = position(second);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const directionX = (b.x - a.x) / distance;
      const directionY = (b.y - a.y) / distance;
      const gap = Math.min(distance * .28, metrics.size * .035);
      const from = [midX - directionX * gap / 2, midY - directionY * gap / 2];
      const to = [midX + directionX * gap / 2, midY + directionY * gap / 2];
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = Math.max(11, metrics.size * .018);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = colors.grid;
      const cap = Math.max(2, metrics.size * .004);
      ctx.beginPath(); ctx.arc(from[0], from[1], cap, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(to[0], to[1], cap, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  function drawStart(level) {
    const p = position(level.start);
    const radius = Math.max(13, metrics.size * .027);
    ctx.save();
    ctx.fillStyle = colors.start;
    ctx.shadowColor = colors.pathGlow;
    ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(7, 22, 18, .72)";
    ctx.beginPath(); ctx.arc(p.x, p.y, radius * .33, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawExit(level) {
    const p = position(level.end);
    const length = Math.max(34, metrics.size * .068);
    const directions = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
    const direction = directions[level.exitDirection || "right"];
    const tip = { x: p.x + direction[0] * length, y: p.y + direction[1] * length };
    const lineWidth = Math.max(9, metrics.size * .016);
    const capRadius = Math.max(11, metrics.size * .021);
    ctx.save();
    ctx.lineCap = "round";

    ctx.strokeStyle = "rgba(3, 15, 12, .72)";
    ctx.lineWidth = lineWidth + Math.max(5, metrics.size * .008);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.strokeStyle = colors.exit;
    ctx.shadowColor = "rgba(208, 245, 175, .68)";
    ctx.shadowBlur = 18;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.shadowBlur = 22;
    ctx.fillStyle = colors.exit;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, capRadius, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(7, 22, 18, .78)";
    ctx.beginPath(); ctx.arc(tip.x, tip.y, capRadius * .35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, .7)";
    ctx.beginPath();
    ctx.arc(tip.x - capRadius * .3, tip.y - capRadius * .3, Math.max(1.5, capRadius * .13), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPath() {
    if (!path.length) return;
    ctx.save();
    ctx.strokeStyle = colors.path;
    ctx.lineWidth = Math.max(9, metrics.size * .018);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = colors.pathGlow;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    path.forEach((point, index) => {
      const p = position(point);
      if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    const tip = position(path[path.length - 1]);
    ctx.fillStyle = colors.path;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, ctx.lineWidth * .7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function nearestNode(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (metrics.size / rect.width);
    const y = (clientY - rect.top) * (metrics.size / rect.height);
    const col = Math.round((x - metrics.originX) / metrics.stepX);
    const row = Math.round((y - metrics.originY) / metrics.stepY);
    const level = currentLevel();
    if (col < 0 || col > level.cols || row < 0 || row > level.rows) return null;
    const p = position([col, row]);
    const distance = Math.hypot(p.x - x, p.y - y);
    return distance <= Math.min(metrics.stepX, metrics.stepY) * .48 ? [col, row] : null;
  }

  function beginPath(node) {
    if (retryTimer) return;
    if (!samePoint(node, currentLevel().start)) return;
    path = [node];
    drawing = true;
    resultCard.hidden = true;
    setStatus("保持连续，向相邻节点画线。");
    playTone(360, .04);
    draw();
  }

  function extendPath(node) {
    if (!drawing || !path.length) return;
    const last = path[path.length - 1];
    if (samePoint(last, node) || !adjacent(last, node)) return;
    if ((currentLevel().blockedEdges || []).some(([a, b]) => edgeKey(a, b) === edgeKey(last, node))) {
      setStatus("道路在这里断开了，请从其他方向绕行。", true);
      playTone(170, .08);
      return;
    }
    const previous = path[path.length - 2];
    if (previous && samePoint(previous, node)) {
      path.pop();
      playTone(300, .025);
    } else if (!path.some((point) => samePoint(point, node))) {
      path.push(node);
      playTone(420 + path.length * 14, .025);
    } else {
      setStatus("路径不能穿过自己；可以沿原路退回。", true);
      return;
    }
    draw();
    if (samePoint(node, currentLevel().end)) finishPath();
  }

  function finishPath() {
    drawing = false;
    const result = validatePath(currentLevel(), path);
    if (result.ok) completeLevel();
    else {
      if (result.missingPoints?.length) flashMissingCheckpoints(result.missingPoints);
      setStatus(`${result.message} 1.5 秒后自动重开本关。`, true);
      playTone(150, .15);
      scheduleRetry();
    }
  }

  function validatePath(level, candidate) {
    if (!candidate.length || !samePoint(candidate[0], level.start) || !samePoint(candidate[candidate.length - 1], level.end)) {
      return { ok: false, message: "路径需要从起点抵达出口。" };
    }
    const visited = new Set(candidate.map(key));
    const missing = (level.checkpoints || []).filter((point) => !visited.has(key(point)));
    if (missing.length) {
      return {
        ok: false,
        message: `还有 ${missing.length} 颗光点没有经过。红色高亮标出了遗漏位置。`,
        missingPoints: missing
      };
    }

    const pathEdges = new Set();
    for (let i = 1; i < candidate.length; i += 1) pathEdges.add(edgeKey(candidate[i - 1], candidate[i]));

    for (const triangle of level.triangles || []) {
      const top = [[triangle.x, triangle.y], [triangle.x + 1, triangle.y]];
      const bottom = [[triangle.x, triangle.y + 1], [triangle.x + 1, triangle.y + 1]];
      const left = [[triangle.x, triangle.y], [triangle.x, triangle.y + 1]];
      const right = [[triangle.x + 1, triangle.y], [triangle.x + 1, triangle.y + 1]];
      const count = [top, bottom, left, right].filter(([a, b]) => pathEdges.has(edgeKey(a, b))).length;
      if (count !== triangle.count) return { ok: false, message: "有三角格贴边数量不对。数一数路径经过了它的几条边。" };
    }

    if ((level.coloredCells || []).length || (level.blossoms || []).length) {
      const regionResult = validateRegionSymbols(level, pathEdges);
      if (!regionResult.ok) return regionResult;
    }
    return { ok: true };
  }

  function collectCellRegions(level, pathEdges) {
    const seen = new Set();
    const regions = [];
    for (let startY = 0; startY < level.rows; startY += 1) {
      for (let startX = 0; startX < level.cols; startX += 1) {
        const startKey = `${startX},${startY}`;
        if (seen.has(startKey)) continue;
        const queue = [[startX, startY]];
        const region = [];
        seen.add(startKey);
        while (queue.length) {
          const [x, y] = queue.shift();
          region.push([x, y]);
          const neighbors = [
            { cell: [x - 1, y], wall: [[x, y], [x, y + 1]] },
            { cell: [x + 1, y], wall: [[x + 1, y], [x + 1, y + 1]] },
            { cell: [x, y - 1], wall: [[x, y], [x + 1, y]] },
            { cell: [x, y + 1], wall: [[x, y + 1], [x + 1, y + 1]] }
          ];
          neighbors.forEach(({ cell, wall }) => {
            const [nx, ny] = cell;
            const nextKey = `${nx},${ny}`;
            if (nx < 0 || nx >= level.cols || ny < 0 || ny >= level.rows || seen.has(nextKey)) return;
            if (pathEdges.has(edgeKey(wall[0], wall[1]))) return;
            seen.add(nextKey); queue.push(cell);
          });
        }
        regions.push(region);
      }
    }
    return regions;
  }

  function validateRegionSymbols(level, pathEdges) {
    const colorAt = new Map((level.coloredCells || []).map((cell) => [`${cell.x},${cell.y}`, cell.color]));
    const blossomAt = new Map((level.blossoms || []).map((cell) => [`${cell.x},${cell.y}`, cell.color]));
    const regions = collectCellRegions(level, pathEdges);
    for (const region of regions) {
      const regionColors = new Set();
      const blossomCounts = new Map();
      region.forEach(([x, y]) => {
        const cellKey = `${x},${y}`;
        if (colorAt.has(cellKey)) regionColors.add(colorAt.get(cellKey));
        if (blossomAt.has(cellKey)) {
          const color = blossomAt.get(cellKey);
          blossomCounts.set(color, (blossomCounts.get(color) || 0) + 1);
        }
      });
      if (regionColors.size > 1) {
        return { ok: false, message: "有不同颜色的方块仍在同一区域，请用路径把它们分开。" };
      }
      if ([...blossomCounts.values()].some((count) => count !== 2)) {
        return { ok: false, message: "有同色花芽没有恰好成双。调整区域边界，让每种花芽两两相伴。" };
      }
    }
    return { ok: true };
  }

  function completeLevel() {
    clearRetryTimer();
    clearCheckpointFlash();
    completed.add(currentLevel().id);
    saveProgress();
    renderLevelDots();
    document.getElementById("resultTitle").textContent = levelIndex === config.levels.length - 1 ? "整座花园亮了起来" : "花园苏醒了";
    nextLevelButton.textContent = levelIndex === config.levels.length - 1 ? "回到第一关" : "进入下一关";
    resultCard.hidden = false;
    setStatus("路径成立。你找到了这座花园的秩序。 ");
    playSuccess();
  }

  function resetPath() {
    clearRetryTimer();
    clearCheckpointFlash();
    path = [];
    drawing = false;
    resultCard.hidden = true;
    setStatus("从发光圆点开始拖动。也可以按空格，再用方向键画线。");
    draw();
  }

  function loadLevel(index) {
    clearRetryTimer();
    clearCheckpointFlash();
    levelIndex = Math.max(0, Math.min(config.levels.length - 1, index));
    const level = currentLevel();
    path = [];
    drawing = false;
    resultCard.hidden = true;
    document.getElementById("levelNumber").textContent = `${String(levelIndex + 1).padStart(2, "0")} / ${String(config.levels.length).padStart(2, "0")}`;
    document.getElementById("levelName").textContent = level.name;
    document.getElementById("levelHint").textContent = level.hint;
    document.getElementById("chapterLabel").textContent = `第${toChineseNumber(levelIndex + 1)}关 · ${level.chapter}`;
    document.getElementById("previousButton").disabled = levelIndex === 0;
    document.getElementById("followingButton").disabled = levelIndex === config.levels.length - 1;
    renderActiveRules();
    renderLevelDots();
    setStatus("从发光圆点开始拖动。也可以按空格，再用方向键画线。");
    requestAnimationFrame(resizeCanvas);
  }

  function clearRetryTimer() {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }

  function scheduleRetry() {
    clearRetryTimer();
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      resetPath();
    }, 1500);
  }

  function clearCheckpointFlash() {
    window.clearTimeout(checkpointFlashTimer);
    checkpointFlashTimer = null;
    missingCheckpoints = new Set();
  }

  function flashMissingCheckpoints(points) {
    window.clearTimeout(checkpointFlashTimer);
    missingCheckpoints = new Set(points.map(key));
    draw();
    checkpointFlashTimer = window.setTimeout(() => {
      missingCheckpoints = new Set();
      checkpointFlashTimer = null;
      draw();
    }, 1100);
  }

  function toChineseNumber(number) {
    return ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][number - 1] || number;
  }

  function activeRuleKeys(level) {
    const rules = ["exit"];
    if (level.checkpoints?.length) rules.push("checkpoint");
    if (level.coloredCells?.length) rules.push("color");
    if (level.triangles?.length) rules.push("triangle");
    if (level.blockedEdges?.length) rules.push("blocked");
    if (level.blossoms?.length) rules.push("blossom");
    return rules;
  }

  function renderActiveRules() {
    const list = document.getElementById("activeRules");
    list.innerHTML = activeRuleKeys(currentLevel()).map((rule) => `<li>${config.rules[rule]}</li>`).join("");
  }

  function renderLevelDots() {
    levelDots.innerHTML = config.levels.map((level, index) => {
      const classes = ["level-dot", index === levelIndex ? "active" : "", completed.has(level.id) ? "completed" : ""].filter(Boolean).join(" ");
      return `<button class="${classes}" type="button" data-level="${index}" aria-label="第 ${index + 1} 关：${level.name}" aria-current="${index === levelIndex ? "step" : "false"}"></button>`;
    }).join("");
  }

  function renderRuleGuide() {
    const labels = {
      exit: ["○→", "起点与出口"],
      checkpoint: ["●", "金色光点"],
      color: ["■", "颜色方块"],
      triangle: ["▲", "计数三角"],
      blocked: ["— —", "断裂道路"],
      blossom: ["✿", "成对花芽"]
    };
    document.getElementById("ruleGuide").innerHTML = Object.entries(config.rules).map(([keyName, text]) => `
      <div class="guide-item">
        <span class="guide-symbol">${labels[keyName][0]}</span>
        <div><strong>${labels[keyName][1]}</strong><p>${text}</p></div>
      </div>`).join("");
  }

  function playTone(frequency, duration) {
    if (!soundEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.035, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch { /* Audio is optional. */ }
  }

  function playSuccess() {
    [520, 660, 820].forEach((tone, index) => window.setTimeout(() => playTone(tone, .2), index * 90));
  }

  canvas.addEventListener("pointerdown", (event) => {
    const node = nearestNode(event.clientX, event.clientY);
    if (!node) return;
    canvas.setPointerCapture(event.pointerId);
    if (!drawing) beginPath(node); else extendPath(node);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing || !(event.buttons || event.pointerType === "touch")) return;
    const node = nearestNode(event.clientX, event.clientY);
    if (node) extendPath(node);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });

  canvas.addEventListener("keydown", (event) => {
    if ((event.key === " " || event.key === "Enter") && !drawing) {
      event.preventDefault(); beginPath(currentLevel().start); return;
    }
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!directions[event.key]) return;
    event.preventDefault();
    if (!drawing) beginPath(currentLevel().start);
    const last = path[path.length - 1];
    const direction = directions[event.key];
    const next = [last[0] + direction[0], last[1] + direction[1]];
    const level = currentLevel();
    if (next[0] >= 0 && next[0] <= level.cols && next[1] >= 0 && next[1] <= level.rows) extendPath(next);
  });

  document.getElementById("resetButton").addEventListener("click", resetPath);
  document.getElementById("previousButton").addEventListener("click", () => loadLevel(levelIndex - 1));
  document.getElementById("followingButton").addEventListener("click", () => loadLevel(levelIndex + 1));
  nextLevelButton.addEventListener("click", () => loadLevel((levelIndex + 1) % config.levels.length));
  levelDots.addEventListener("click", (event) => {
    const button = event.target.closest("[data-level]");
    if (button) loadLevel(Number(button.dataset.level));
  });
  document.getElementById("soundToggle").addEventListener("click", (event) => {
    soundEnabled = !soundEnabled;
    event.currentTarget.textContent = `声音：${soundEnabled ? "开" : "关"}`;
    event.currentTarget.setAttribute("aria-pressed", String(soundEnabled));
    if (soundEnabled) playTone(520, .08);
  });
  document.getElementById("rulesButton").addEventListener("click", () => rulesDialog.showModal());
  document.getElementById("closeRulesButton").addEventListener("click", () => rulesDialog.close());
  rulesDialog.addEventListener("click", (event) => { if (event.target === rulesDialog) rulesDialog.close(); });
  window.addEventListener("resize", resizeCanvas);

  document.getElementById("gameTitle").textContent = config.game.title;
  document.getElementById("gameSubtitle").textContent = config.game.subtitle;
  renderRuleGuide();
  loadLevel(0);
})();
