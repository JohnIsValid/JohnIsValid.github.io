(() => {
  "use strict";

  const LEVEL_NAMES = [
    "启程", "转角", "上行", "折线", "远岸", "第一盏灯", "双灯", "回望", "灯列", "巡光", 
    "灯塔", "两种土壤", "色彩边界", "错位花圃", "双重分界", "曲折分区", "四色庭院", "第一道刻痕", "贴边", "数字阶梯",
    "数与光", "分区刻度", "精确转身", "断开的路", "缺口", "绕行", "断径分色", "灯下断桥", "刻度迷径", "花芽初绽",
    "一双花", "花与灯", "花圃边界", "断径花园", "计数花瓣", "交织", "双重约束", "曲径成双", "三色回廊", "灯火花契",
    "边界回声", "密林", "五重庭院", "月下折线", "群花", "深层秩序", "无声花园", "最终回廊", "万物归位", "园心"
  ];

  function pointKey(point) { return `${point[0]},${point[1]}`; }
  function edgeKey(a, b) { return [pointKey(a), pointKey(b)].sort().join("|"); }

  function createDiagonalPath(cols, rows, seed) {
    const path = [[0, rows]];
    let x = 0;
    let y = rows;
    let stepIndex = 0;
    while (x < cols || y > 0) {
      if (x === cols) y -= 1;
      else if (y === 0) x += 1;
      else {
        const horizontalProgress = x / cols;
        const verticalProgress = (rows - y) / rows;
        const preferRight = horizontalProgress < verticalProgress ||
          (horizontalProgress === verticalProgress && (seed + stepIndex) % 2 === 0);
        if (preferRight) x += 1;
        else y -= 1;
      }
      path.push([x, y]);
      stepIndex += 1;
    }
    return path;
  }

  function pathEdges(path) {
    return new Set(path.slice(1).map((point, index) => edgeKey(path[index], point)));
  }

  function collectRegions(cols, rows, walls) {
    const seen = new Set();
    const regions = [];
    for (let startY = 0; startY < rows; startY += 1) {
      for (let startX = 0; startX < cols; startX += 1) {
        const startKey = `${startX},${startY}`;
        if (seen.has(startKey)) continue;
        const queue = [[startX, startY]];
        const region = [];
        seen.add(startKey);
        while (queue.length) {
          const [x, y] = queue.shift();
          region.push([x, y]);
          const neighbors = [
            [x - 1, y, [[x, y], [x, y + 1]]],
            [x + 1, y, [[x + 1, y], [x + 1, y + 1]]],
            [x, y - 1, [[x, y], [x + 1, y]]],
            [x, y + 1, [[x, y + 1], [x + 1, y + 1]]]
          ];
          neighbors.forEach(([nextX, nextY, wall]) => {
            const nextKey = `${nextX},${nextY}`;
            if (nextX < 0 || nextX >= cols || nextY < 0 || nextY >= rows || seen.has(nextKey)) return;
            if (walls.has(edgeKey(wall[0], wall[1]))) return;
            seen.add(nextKey);
            queue.push([nextX, nextY]);
          });
        }
        regions.push(region);
      }
    }
    return regions.sort((a, b) => b.length - a.length);
  }

  function rankCell(cell, seed) {
    return (((cell[0] + 1) * 73856093) ^ ((cell[1] + 1) * 19349663) ^ (seed * 83492791)) >>> 0;
  }

  function pickCells(cells, count, seed, occupied) {
    const available = cells
      .filter(([x, y]) => !occupied.has(`${x},${y}`))
      .sort((a, b) => rankCell(a, seed) - rankCell(b, seed));
    const picked = available.slice(0, Math.min(count, available.length));
    picked.forEach(([x, y]) => occupied.add(`${x},${y}`));
    return picked;
  }

  function allGridEdges(cols, rows) {
    const edges = [];
    for (let y = 0; y <= rows; y += 1) {
      for (let x = 0; x < cols; x += 1) edges.push([[x, y], [x + 1, y]]);
    }
    for (let x = 0; x <= cols; x += 1) {
      for (let y = 0; y < rows; y += 1) edges.push([[x, y], [x, y + 1]]);
    }
    return edges;
  }

  function mechanicsFor(levelNumber) {
    if (levelNumber < 6) return {};
    if (levelNumber < 12) return { checkpoint: true };
    if (levelNumber === 12) return { color: true };
    if (levelNumber < 18) return { checkpoint: levelNumber % 2 === 1, color: true };
    if (levelNumber === 18) return { triangle: true };
    if (levelNumber < 24) {
      return { checkpoint: levelNumber % 2 === 0, color: levelNumber % 3 !== 0, triangle: true };
    }
    if (levelNumber === 24) return { blocked: true };
    if (levelNumber < 30) {
      return {
        checkpoint: levelNumber % 2 === 1,
        color: levelNumber % 3 !== 1,
        triangle: levelNumber % 2 === 0,
        blocked: true
      };
    }
    if (levelNumber === 30) {
      return { checkpoint: true, color: true, triangle: true, blocked: true, blossom: true };
    }
    return {
      checkpoint: levelNumber % 2 === 0 || levelNumber >= 45,
      color: levelNumber % 3 !== 1 || levelNumber >= 45,
      triangle: levelNumber % 3 !== 2 || levelNumber >= 45,
      blocked: levelNumber % 4 !== 0 || levelNumber >= 45,
      blossom: true
    };
  }

  function chapterFor(levelNumber) {
    if (levelNumber < 6) return "序章 · 引路";
    if (levelNumber < 12) return "第一章 · 萤火";
    if (levelNumber < 18) return "第二章 · 分界";
    if (levelNumber < 24) return "第三章 · 刻度";
    if (levelNumber < 30) return "第四章 · 断径";
    if (levelNumber < 36) return "第五章 · 花契";
    if (levelNumber < 42) return "第六章 · 交织";
    if (levelNumber < 48) return "第七章 · 回响";
    return "终章 · 园心";
  }

  function hintFor(levelNumber, mechanics) {
    const introductions = {
      1: "从左侧的发光圆点出发，向右画到出口。",
      6: "新元素：路径必须经过每一颗金色光点。",
      12: "新元素：用路径分开不同颜色的方块。",
      18: "新元素：三角数量表示路径贴着格子的边数。",
      24: "新元素：断开的道路不能经过，请寻找绕行路线。",
      30: "新元素：同色花芽必须在同一区域内恰好成双。五种规则首次同时生效。"
    };
    if (introductions[levelNumber]) return introductions[levelNumber];
    const active = [];
    if (mechanics.checkpoint) active.push("光点");
    if (mechanics.color) active.push("分区");
    if (mechanics.triangle) active.push("计边");
    if (mechanics.blocked) active.push("断径");
    if (mechanics.blossom) active.push("花芽配对");
    if (!active.length) return "找到起点与出口之间顺畅的路线。";
    return `本关组合：${active.join("、")}。先观察整体，再开始画线。`;
  }

  function buildLevel(levelNumber) {
    if (levelNumber === 1) {
      return {
        id: "level-01",
        name: LEVEL_NAMES[0],
        chapter: chapterFor(1),
        hint: hintFor(1, {}),
        cols: 5,
        rows: 2,
        start: [0, 1],
        end: [5, 1],
        exitDirection: "right"
      };
    }

    const baseSize = levelNumber < 18 ? 4 : levelNumber < 36 ? 5 : 6;
    const cols = baseSize + (levelNumber % 10 === 0 ? 1 : 0);
    const rows = Math.max(3, baseSize - (levelNumber % 8 === 0 ? 1 : 0));
    const solution = createDiagonalPath(cols, rows, levelNumber);
    const walls = pathEdges(solution);
    const regions = collectRegions(cols, rows, walls);
    const mechanics = mechanicsFor(levelNumber);
    const occupied = new Set();
    const level = {
      id: `level-${String(levelNumber).padStart(2, "0")}`,
      name: LEVEL_NAMES[levelNumber - 1],
      chapter: chapterFor(levelNumber),
      hint: hintFor(levelNumber, mechanics),
      cols,
      rows,
      start: solution[0],
      end: solution[solution.length - 1],
      exitDirection: "right"
    };

    if (mechanics.color && regions.length >= 2) {
      const first = pickCells(regions[0], levelNumber >= 36 ? 3 : 2, levelNumber, occupied);
      const second = pickCells(regions[1], levelNumber >= 36 ? 3 : 2, levelNumber + 17, occupied);
      level.coloredCells = [
        ...first.map(([x, y]) => ({ x, y, color: "teal" })),
        ...second.map(([x, y]) => ({ x, y, color: "coral" }))
      ];
    }

    if (mechanics.blossom && regions.length >= 2) {
      const lavender = pickCells(regions[0], 2, levelNumber + 31, occupied);
      const sky = pickCells(regions[1], 2, levelNumber + 53, occupied);
      level.blossoms = [
        ...lavender.map(([x, y]) => ({ x, y, color: "lavender" })),
        ...sky.map(([x, y]) => ({ x, y, color: "sky" }))
      ];
    }

    if (mechanics.triangle) {
      const candidates = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (occupied.has(`${x},${y}`)) continue;
          const sides = [
            [[x, y], [x + 1, y]], [[x, y + 1], [x + 1, y + 1]],
            [[x, y], [x, y + 1]], [[x + 1, y], [x + 1, y + 1]]
          ];
          const count = sides.filter(([a, b]) => walls.has(edgeKey(a, b))).length;
          if (count > 0 && count < 4) candidates.push({ x, y, count });
        }
      }
      const triangleCount = Math.min(2 + Math.floor((levelNumber - 18) / 8), 6);
      level.triangles = candidates
        .sort((a, b) => rankCell([a.x, a.y], levelNumber + 71) - rankCell([b.x, b.y], levelNumber + 71))
        .slice(0, triangleCount);
      level.triangles.forEach(({ x, y }) => occupied.add(`${x},${y}`));
    }

    if (mechanics.checkpoint) {
      const internal = solution.slice(1, -1);
      const desired = Math.min(2 + Math.floor((levelNumber - 6) / 10), 6, internal.length);
      const selected = new Map();
      for (let index = 0; index < desired; index += 1) {
        const pathIndex = Math.round(((index + 1) * (internal.length - 1)) / (desired + 1));
        selected.set(pointKey(internal[pathIndex]), internal[pathIndex]);
      }
      level.checkpoints = [...selected.values()];
    }

    if (mechanics.blocked) {
      const candidates = allGridEdges(cols, rows)
        .filter(([a, b]) => !walls.has(edgeKey(a, b)))
        .sort((a, b) => rankCell(a[0], levelNumber + 97) - rankCell(b[0], levelNumber + 97));
      const count = Math.min(2 + Math.floor((levelNumber - 24) / 7), 6);
      level.blockedEdges = candidates.slice(0, count);
    }

    return level;
  }

  const levels = Array.from({ length: 50 }, (_, index) => buildLevel(index + 1));

  window.LINE_GARDEN_CONFIG = {
    game: {
      title: "回路花园",
      subtitle: "观察符号，画出唯一属于你的路径",
      storageKey: "line-garden-progress-v2"
    },
    rules: {
      exit: "从发光圆点出发，连续画到带圆形端帽的出口。",
      checkpoint: "路径必须经过每一颗金色光点。",
      color: "路径会切分区域；同一区域内不能出现不同颜色的方块。",
      triangle: "三角的数量，表示路径必须经过该格子的几条边。",
      blocked: "道路上的断口不能经过，路径必须从其他方向绕行。",
      blossom: "同色花芽在一个区域内必须恰好出现两个；一朵或三朵都不成立。"
    },
    levels
  };
})();
