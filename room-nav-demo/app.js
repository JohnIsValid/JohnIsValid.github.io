const world = document.querySelector(".world");
const player = document.querySelector(".player");
const statusText = document.querySelector(".status-text");
const rooms = Array.from(document.querySelectorAll(".room"));

const roomPages = {
  articles: "rooms/articles.html",
  recommend: "rooms/recommend.html",
  resume: "rooms/resume.html",
  contact: "rooms/contact.html",
};

const spawnPoints = {
  articles: { x: 360, y: 170 },
  recommend: { x: 700, y: 170 },
  resume: { x: 360, y: 430 },
  contact: { x: 700, y: 430 },
  default: { x: 540, y: 310 },
};

const keys = new Set();
const playerState = {
  x: spawnPoints.default.x,
  y: spawnPoints.default.y,
  targetX: spawnPoints.default.x,
  targetY: spawnPoints.default.y,
  speed: 3,
  entering: false,
  exitGraceUntil: 0,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const scalePointToWorld = (point) => {
  const rect = world.getBoundingClientRect();
  return {
    x: (point.x / 1080) * rect.width,
    y: (point.y / 620) * rect.height,
  };
};

const placePlayer = () => {
  player.style.transform = `translate(${playerState.x}px, ${playerState.y}px) translate(-50%, -50%)`;
};

const getPlayerRect = () => {
  const size = 34;
  return {
    left: playerState.x - size / 2,
    right: playerState.x + size / 2,
    top: playerState.y - size / 2,
    bottom: playerState.y + size / 2,
  };
};

const intersects = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const getRoomTriggerRect = (room) => {
  const worldRect = world.getBoundingClientRect();
  const roomRect = room.getBoundingClientRect();
  const roomName = room.dataset.room;
  const trigger = {
    articles: {
      left: roomRect.right - worldRect.left - 10,
      right: roomRect.right - worldRect.left + 44,
      top: roomRect.top - worldRect.top + 24,
      bottom: roomRect.bottom - worldRect.top - 24,
    },
    recommend: {
      left: roomRect.left - worldRect.left - 44,
      right: roomRect.left - worldRect.left + 10,
      top: roomRect.top - worldRect.top + 24,
      bottom: roomRect.bottom - worldRect.top - 24,
    },
    resume: {
      left: roomRect.right - worldRect.left - 10,
      right: roomRect.right - worldRect.left + 44,
      top: roomRect.top - worldRect.top + 24,
      bottom: roomRect.bottom - worldRect.top - 24,
    },
    contact: {
      left: roomRect.left - worldRect.left - 44,
      right: roomRect.left - worldRect.left + 10,
      top: roomRect.top - worldRect.top + 24,
      bottom: roomRect.bottom - worldRect.top - 24,
    },
  };

  return trigger[roomName];
};

const enterRoom = (roomName) => {
  if (playerState.entering) return;

  playerState.entering = true;
  sessionStorage.setItem("roomNav:lastRoom", roomName);
  player.classList.add("is-entering");
  statusText.textContent = `进入${rooms.find((room) => room.dataset.room === roomName)?.querySelector("span")?.textContent || "房间"}...`;

  window.setTimeout(() => {
    window.location.href = roomPages[roomName];
  }, 220);
};

const updateNearRoom = () => {
  const playerRect = getPlayerRect();
  let nearRoom = null;

  rooms.forEach((room) => {
    const isNear = intersects(playerRect, getRoomTriggerRect(room));
    room.classList.toggle("is-near", isNear);

    if (isNear) nearRoom = room;
  });

  if (nearRoom) {
    const roomName = nearRoom.dataset.room;
    statusText.textContent = `正在进入：${nearRoom.querySelector("span").textContent}`;
    if (Date.now() > playerState.exitGraceUntil) {
      enterRoom(roomName);
    }
  } else {
    statusText.textContent = "靠近一个房间门试试看。";
  }
};

const updatePlayer = () => {
  if (playerState.entering) return;

  const rect = world.getBoundingClientRect();
  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    playerState.x = clamp(playerState.x + (dx / length) * playerState.speed, 18, rect.width - 18);
    playerState.y = clamp(playerState.y + (dy / length) * playerState.speed, 24, rect.height - 24);
    playerState.targetX = playerState.x;
    playerState.targetY = playerState.y;
    placePlayer();
    updateNearRoom();
    return;
  }

  const targetDx = playerState.targetX - playerState.x;
  const targetDy = playerState.targetY - playerState.y;
  const targetDistance = Math.hypot(targetDx, targetDy);

  if (targetDistance > 1) {
    const step = Math.min(playerState.speed, targetDistance);
    playerState.x = clamp(playerState.x + (targetDx / targetDistance) * step, 18, rect.width - 18);
    playerState.y = clamp(playerState.y + (targetDy / targetDistance) * step, 24, rect.height - 24);
    placePlayer();
    updateNearRoom();
  }
};

const loop = () => {
  updatePlayer();
  window.requestAnimationFrame(loop);
};

const spawnFromLastRoom = () => {
  const url = new URL(window.location.href);
  const roomFromUrl = url.searchParams.get("from");
  const lastRoom = roomFromUrl || sessionStorage.getItem("roomNav:lastRoom") || "default";
  const point = scalePointToWorld(spawnPoints[lastRoom] || spawnPoints.default);

  playerState.x = point.x;
  playerState.y = point.y;
  playerState.targetX = point.x;
  playerState.targetY = point.y;
  playerState.entering = false;
  playerState.exitGraceUntil = roomFromUrl ? Date.now() + 900 : 0;
  player.classList.remove("is-entering");
  placePlayer();

  if (roomFromUrl) {
    history.replaceState(null, "", "index.html");
  }
};

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d"].includes(event.key)) {
    event.preventDefault();
    keys.add(event.key);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

world.addEventListener("click", (event) => {
  if (playerState.entering) return;

  const rect = world.getBoundingClientRect();
  playerState.targetX = clamp(event.clientX - rect.left, 18, rect.width - 18);
  playerState.targetY = clamp(event.clientY - rect.top, 24, rect.height - 24);
});

window.addEventListener("resize", spawnFromLastRoom);

spawnFromLastRoom();
loop();
