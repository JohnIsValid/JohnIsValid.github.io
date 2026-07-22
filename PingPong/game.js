const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#gameOverlay");
const overlayKicker = document.querySelector("#overlayKicker");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayCopy = document.querySelector("#overlayCopy");
const primaryButton = document.querySelector("#primaryButton");
const restartButton = document.querySelector("#restartButton");
const soundButton = document.querySelector("#soundButton");
const scoreValue = document.querySelector("#scoreValue");
const livesValue = document.querySelector("#livesValue");
const brickCount = document.querySelector("#brickCount");
const liveStatus = document.querySelector("#liveStatus");

const WORLD = { width: 1200, height: 720 };
const BRICK_ROWS = 5;
const BRICK_COLUMNS = 10;
const BRICK_COLOR = "#7cf29a";
const IRON_SLOTS = new Set(["1-2", "1-7", "3-2", "3-7"]);
const DROP_RATE_SPLIT_ALL = 0.0025;
const DROP_RATE_PADDLE_BALL = 0.0125;
const DROP_RATE_WIDE_PADDLE = 0.015;
const DROP_RATE_FAST_PADDLE = 0.015;
const BASE_PADDLE_WIDTH = 110;
const MAX_PADDLE_WIDTH = 182;
const BASE_PADDLE_SPEED = 650;
const MAX_PADDLE_SPEED = 790;
const keys = new Set();
const paddle = { x: 545, y: 660, width: BASE_PADDLE_WIDTH, height: 14, speed: BASE_PADDLE_SPEED };

let bricks = [];
let balls = [];
let powerUps = [];
let score = 0;
let lives = 1;
let state = "ready";
let lastTime = performance.now();
let soundOn = true;
let audioContext;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
}

function beep(frequency, duration = 0.05, volume = 0.035) {
  if (!soundOn) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function makeBall({ x, y, vx = 0, vy = 0, attached = false }) {
  return { x, y, radius: 8, vx, vy, attached, trail: [] };
}

function createBricks() {
  const gap = 2;
  const brickWidth = 61.5;
  const brickHeight = 22;
  const marginX = (WORLD.width - brickWidth * BRICK_COLUMNS - gap * (BRICK_COLUMNS - 1)) / 2;
  bricks = [];
  for (let row = 0; row < BRICK_ROWS; row += 1) {
    for (let column = 0; column < BRICK_COLUMNS; column += 1) {
      const indestructible = IRON_SLOTS.has(`${row}-${column}`);
      bricks.push({
        x: marginX + column * (brickWidth + gap),
        y: 72 + row * (brickHeight + gap),
        width: brickWidth,
        height: brickHeight,
        indestructible,
        active: true
      });
    }
  }
}

function resetBalls() {
  paddle.x = WORLD.width / 2 - paddle.width / 2;
  balls = [makeBall({
    x: paddle.x + paddle.width / 2,
    y: paddle.y - 12,
    attached: true
  })];
  powerUps = [];
}

function updateHud() {
  scoreValue.textContent = score;
  livesValue.textContent = lives;
  brickCount.textContent = bricks.filter((brick) => brick.active && !brick.indestructible).length;
}

function showOverlay(kicker, title, copy, buttonLabel) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  primaryButton.textContent = buttonLabel;
  overlay.hidden = false;
}

function launchAttachedBalls() {
  const attachedBalls = balls.filter((ball) => ball.attached);
  for (const ball of attachedBalls) {
    ball.attached = false;
    ball.vx = (Math.random() > 0.5 ? 1 : -1) * 205;
    ball.vy = -365;
  }
  if (attachedBalls.length) beep(560, 0.08);
}

function startGame() {
  if (state === "won" || state === "over") restartGame();
  state = "playing";
  overlay.hidden = true;
  canvas.focus();
  lastTime = performance.now();
}

function restartGame() {
  score = 0;
  lives = 1;
  paddle.width = BASE_PADDLE_WIDTH;
  paddle.speed = BASE_PADDLE_SPEED;
  createBricks();
  resetBalls();
  updateHud();
  state = "ready";
  showOverlay("BREAKOUT READY", "准备发球？", "按任意键发射弹球，左右方向键控制挡板。接住掉落可增加弹球或强化挡板。", "开始挑战");
}

function togglePause() {
  if (state === "playing" && !balls.some((ball) => ball.attached)) {
    state = "paused";
    showOverlay("SYSTEM PAUSED", "游戏暂停", "场上的弹球和道具已经停住。", "继续游戏");
  } else if (state === "paused") {
    state = "playing";
    overlay.hidden = true;
    lastTime = performance.now();
    canvas.focus();
  }
}

function loseGame() {
  lives = 0;
  updateHud();
  powerUps = [];
  beep(150, 0.22, 0.06);
  liveStatus.textContent = "所有弹球均已掉出，游戏结束";
  state = "over";
  showOverlay("RUN FAILED", "游戏结束", `本次得分 ${score}。最后一个弹球已经掉出场外。`, "重新挑战");
}

function winGame() {
  state = "won";
  for (const ball of balls) { ball.vx = 0; ball.vy = 0; }
  powerUps = [];
  beep(820, 0.25, 0.06);
  showOverlay("ALL CLEAR", "全部击碎！", `最终得分 ${score}，你成功守住了弹球。`, "再来一局");
  liveStatus.textContent = "全部砖块已击碎，挑战成功";
}

function movePaddle(amount) {
  paddle.x = clamp(paddle.x + amount, 18, WORLD.width - paddle.width - 18);
  for (const ball of balls) {
    if (ball.attached) ball.x = paddle.x + paddle.width / 2;
  }
}

function circleHitsRect(ball, rect) {
  const closestX = clamp(ball.x, rect.x, rect.x + rect.width);
  const closestY = clamp(ball.y, rect.y, rect.y + rect.height);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy <= ball.radius * ball.radius;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function bounceFromRect(ball, rect, previousX, previousY) {
  const wasAbove = previousY + ball.radius <= rect.y;
  const wasBelow = previousY - ball.radius >= rect.y + rect.height;
  const wasLeft = previousX + ball.radius <= rect.x;
  const wasRight = previousX - ball.radius >= rect.x + rect.width;
  if (wasAbove || wasBelow) ball.vy *= -1;
  else if (wasLeft || wasRight) ball.vx *= -1;
  else ball.vy *= -1;
}

function maybeDropPowerUp(brick) {
  const roll = Math.random();
  let type = null;
  if (roll < DROP_RATE_SPLIT_ALL) type = "split";
  else if (roll < DROP_RATE_SPLIT_ALL + DROP_RATE_PADDLE_BALL) type = "paddleBall";
  else if (roll < DROP_RATE_SPLIT_ALL + DROP_RATE_PADDLE_BALL + DROP_RATE_WIDE_PADDLE) type = "widePaddle";
  else if (roll < DROP_RATE_SPLIT_ALL + DROP_RATE_PADDLE_BALL + DROP_RATE_WIDE_PADDLE + DROP_RATE_FAST_PADDLE) type = "fastPaddle";
  if (!type) return;
  powerUps.push({
    x: brick.x + brick.width / 2 - 14,
    y: brick.y + brick.height / 2 - 14,
    width: 28,
    height: 28,
    vy: 125,
    type
  });
}

function rotateVelocity(ball, angle) {
  const speed = Math.hypot(ball.vx, ball.vy);
  const currentAngle = Math.atan2(ball.vy, ball.vx) + angle;
  ball.vx = Math.cos(currentAngle) * speed;
  ball.vy = Math.sin(currentAngle) * speed;
}

function splitAllBalls() {
  const originals = balls.filter((ball) => !ball.attached);
  const clones = [];
  for (const ball of originals) {
    rotateVelocity(ball, -0.16);
    const clone = makeBall({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
    rotateVelocity(clone, 0.32);
    clones.push(clone);
  }
  balls.push(...clones);
  liveStatus.textContent = `全体分裂，场上现在有 ${balls.length} 个弹球`;
  beep(900, 0.16, 0.055);
}

function firePaddleBall() {
  balls.push(makeBall({
    x: paddle.x + paddle.width / 2,
    y: paddle.y - 12,
    vx: (Math.random() > 0.5 ? 1 : -1) * 185,
    vy: -375
  }));
  liveStatus.textContent = `挡板发射新球，场上现在有 ${balls.length} 个弹球`;
  beep(720, 0.12, 0.05);
}

function widenPaddle() {
  const center = paddle.x + paddle.width / 2;
  paddle.width = Math.min(paddle.width + 18, MAX_PADDLE_WIDTH);
  paddle.x = clamp(center - paddle.width / 2, 18, WORLD.width - paddle.width - 18);
  movePaddle(0);
  liveStatus.textContent = paddle.width >= MAX_PADDLE_WIDTH
    ? "挡板已达到最大宽度"
    : "挡板变宽了一点";
  beep(640, 0.14, 0.05);
}

function speedUpPaddle() {
  paddle.speed = Math.min(paddle.speed + 35, MAX_PADDLE_SPEED);
  liveStatus.textContent = paddle.speed >= MAX_PADDLE_SPEED
    ? "挡板已达到最大移动速度"
    : "挡板移动速度提升了一点";
  beep(780, 0.1, 0.045);
}

function activatePowerUp(powerUp) {
  if (powerUp.type === "split") splitAllBalls();
  else if (powerUp.type === "paddleBall") firePaddleBall();
  else if (powerUp.type === "widePaddle") widenPaddle();
  else speedUpPaddle();
}

function updateBall(ball, dt) {
  if (ball.attached) {
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius - 4;
    return;
  }

  const previousX = ball.x;
  const previousY = ball.y;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.trail.unshift({ x: ball.x, y: ball.y });
  if (ball.trail.length > 10) ball.trail.pop();

  if (ball.x - ball.radius <= 10 && ball.vx < 0) { ball.x = 10 + ball.radius; ball.vx *= -1; beep(300); }
  if (ball.x + ball.radius >= WORLD.width - 10 && ball.vx > 0) { ball.x = WORLD.width - 10 - ball.radius; ball.vx *= -1; beep(300); }
  if (ball.y - ball.radius <= 10 && ball.vy < 0) { ball.y = 10 + ball.radius; ball.vy *= -1; beep(330); }

  if (ball.vy > 0 && circleHitsRect(ball, paddle)) {
    const contact = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.015, 600);
    const angle = contact * 1.02;
    ball.vx = speed * Math.sin(angle);
    ball.vy = -Math.abs(speed * Math.cos(angle));
    ball.y = paddle.y - ball.radius;
    beep(470 + Math.abs(contact) * 160);
  }

  for (const brick of bricks) {
    if (!brick.active || !circleHitsRect(ball, brick)) continue;
    bounceFromRect(ball, brick, previousX, previousY);
    ball.x = previousX;
    ball.y = previousY;
    if (!brick.indestructible) {
      brick.active = false;
      score += 100;
      maybeDropPowerUp(brick);
    }
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) + (brick.indestructible ? 0 : 2), 600);
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    ball.vx = ball.vx / currentSpeed * speed;
    ball.vy = ball.vy / currentSpeed * speed;
    updateHud();
    beep(brick.indestructible ? 250 : 620, brick.indestructible ? 0.035 : 0.055);
    break;
  }
}

function updatePowerUps(dt) {
  const paddleRect = { x: paddle.x, y: paddle.y - 4, width: paddle.width, height: paddle.height + 8 };
  for (const powerUp of powerUps) {
    powerUp.y += powerUp.vy * dt;
    if (rectsOverlap(powerUp, paddleRect)) {
      powerUp.collected = true;
      activatePowerUp(powerUp);
    }
  }
  powerUps = powerUps.filter((powerUp) => !powerUp.collected && powerUp.y < WORLD.height + powerUp.height);
}

function update(dt) {
  if (state !== "playing") return;

  let direction = 0;
  if (keys.has("arrowleft")) direction -= 1;
  if (keys.has("arrowright")) direction += 1;
  movePaddle(direction * paddle.speed * dt);

  for (const ball of [...balls]) updateBall(ball, dt);
  balls = balls.filter((ball) => ball.y - ball.radius <= WORLD.height);
  if (!balls.length) {
    loseGame();
    return;
  }

  updatePowerUps(dt);
  if (!bricks.some((brick) => brick.active && !brick.indestructible)) winGame();
}

function drawRoundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawField() {
  const gradient = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
  gradient.addColorStop(0, "#081b13");
  gradient.addColorStop(1, "#06100c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.strokeStyle = "rgba(124, 242, 154, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke(); }
  for (let y = 0; y <= WORLD.height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke(); }
}

function drawBricks() {
  for (const brick of bricks) {
    if (!brick.active) continue;
    if (brick.indestructible) {
      ctx.shadowBlur = 5;
      ctx.shadowColor = "rgba(210, 226, 217, .35)";
      ctx.fillStyle = "#5e6b64";
      drawRoundedRect(brick.x, brick.y, brick.width, brick.height, 3);
      ctx.strokeStyle = "#aebdb5";
      ctx.lineWidth = 2;
      ctx.strokeRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height - 4);
      ctx.fillStyle = "#d5dfda";
      ctx.beginPath();
      ctx.arc(brick.x + 9, brick.y + brick.height / 2, 2.2, 0, Math.PI * 2);
      ctx.arc(brick.x + brick.width - 9, brick.y + brick.height / 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowBlur = 9;
      ctx.shadowColor = BRICK_COLOR;
      ctx.fillStyle = BRICK_COLOR;
      drawRoundedRect(brick.x, brick.y, brick.width, brick.height, 3);
      ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.fillRect(brick.x + 5, brick.y + 4, brick.width - 10, 2);
    }
  }
}

function drawBalls() {
  for (const ball of balls) {
    ball.trail.forEach((point, index) => {
      ctx.globalAlpha = (1 - index / ball.trail.length) * 0.24;
      ctx.fillStyle = "#e9f5ec";
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(2, ball.radius - index * 0.6), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPowerUps() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 13px 'IBM Plex Mono', monospace";
  for (const powerUp of powerUps) {
    const split = powerUp.type === "split";
    const newBall = powerUp.type === "paddleBall";
    const widePaddle = powerUp.type === "widePaddle";
    const color = split ? "#f5d76e" : newBall ? "#5ce1e6" : widePaddle ? "#b8a1ff" : "#ff9f7c";
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;
    ctx.fillStyle = "#0b1913";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height, 7);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillText(split ? "×2" : newBall ? "+1" : widePaddle ? "↔" : "»", powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2 + 1);
  }
}

function draw() {
  const scaleX = canvas.width / WORLD.width;
  const scaleY = canvas.height / WORLD.height;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  drawField();
  drawBricks();

  ctx.shadowBlur = 22;
  ctx.shadowColor = "#7cf29a";
  ctx.fillStyle = "#7cf29a";
  drawRoundedRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
  drawPowerUps();
  drawBalls();
  if (state === "playing" && balls.some((ball) => ball.attached)) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(233, 245, 236, .78)";
    ctx.font = "500 15px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("按任意键发球", WORLD.width / 2, paddle.y - 34);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.025);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const waitingToLaunch = state === "playing" && balls.some((ball) => ball.attached);
  if (waitingToLaunch) launchAttachedBalls();
  if (key === "arrowleft" || key === "arrowright") {
    event.preventDefault();
    keys.add(key);
  } else if (key === " " && !waitingToLaunch) {
    event.preventDefault();
    togglePause();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
primaryButton.addEventListener("click", () => state === "paused" ? togglePause() : startGame());
restartButton.addEventListener("click", restartGame);
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  soundButton.textContent = `声音：${soundOn ? "开" : "关"}`;
  soundButton.setAttribute("aria-pressed", String(soundOn));
  if (soundOn) beep(600);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing" && !balls.some((ball) => ball.attached)) togglePause();
});

createBricks();
resetBalls();
updateHud();
resizeCanvas();
draw();
requestAnimationFrame(frame);
