const config = window.BEACH_LANDING_CONFIG;
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreValue = document.querySelector("#scoreValue");
const healthValue = document.querySelector("#healthValue");
const statusValue = document.querySelector("#statusValue");
const weaponNameValue = document.querySelector("#weaponNameValue");
const ammoValue = document.querySelector("#ammoValue");
const weaponHud = document.querySelector("#weaponHud");
const healthHud = document.querySelector("#healthHud");
const overlay = document.querySelector("#gameOverlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayCopy = document.querySelector("#overlayCopy");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");

const world = { width: canvas.width, height: canvas.height };
const player = { x: world.width / 2, y: world.height / 2, radius: config.player.radius };
const itemConfig = config.itemDrops;
let aim = { x: world.width / 2, y: 0 };
let bullets = [], enemies = [], items = [], deathEffects = [];
let playerHealth, score, elapsed, nextShotAt, spawnTimer, running, previousTime, isFiring = false;
let fireRateBoostMultiplier = 1, fireRateBoostUntil = 0;
let weapons = [], selectedWeaponIndex = 0;
const pressedKeys = new Set();

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const nextWidth = Math.max(1, Math.round(rect.width));
  const nextHeight = Math.max(1, Math.round(rect.height));
  if (nextWidth === world.width && nextHeight === world.height) return;
  const scaleX = nextWidth / world.width;
  const scaleY = nextHeight / world.height;
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  world.width = nextWidth;
  world.height = nextHeight;
  player.x *= scaleX; player.y *= scaleY;
  aim.x *= scaleX; aim.y *= scaleY;
  bullets.forEach((bullet) => { bullet.x *= scaleX; bullet.y *= scaleY; bullet.vx *= scaleX; bullet.vy *= scaleY; });
  enemies.forEach((enemy) => { enemy.x *= scaleX; enemy.y *= scaleY; });
  items.forEach((item) => { item.x *= scaleX; item.y *= scaleY; });
}

function randomEnemyType() {
  const types = config.enemyTypes.filter((type) => type.probability > 0);
  const total = types.reduce((sum, type) => sum + type.probability, 0);
  let roll = Math.random() * total;
  return types.find((type) => (roll -= type.probability) <= 0) || types[0];
}

function shortestAngleDifference(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function spawnEnemy() {
  const type = randomEnemyType();
  const margin = type.radius + 12;
  const positions = [
    { x: Math.random() * world.width, y: -margin }, { x: world.width + margin, y: Math.random() * world.height },
    { x: Math.random() * world.width, y: world.height + margin }, { x: -margin, y: Math.random() * world.height }
  ];
  const position = positions[Math.floor(Math.random() * positions.length)];
  const heading = Math.atan2(player.y - position.y, player.x - position.x);
  enemies.push({ ...position, type, heading, health: type.health, dropChance: type.dropChance ?? 0, nextAttackAt: 0 });
}

function currentWeapon() { return weapons[selectedWeaponIndex]; }

function resetWeapons() {
  weapons = config.player.weapons.map((weapon) => ({ ...weapon, ammo: weapon.magazineSize, reserve: weapon.reserveAmmo, reloadEnd: 0 }));
  selectedWeaponIndex = 0;
}

function updateWeaponHud() {
  const weapon = currentWeapon();
  const empty = weapon.ammo === 0 && weapon.reserve === 0 && !weapon.reloadEnd;
  weaponNameValue.textContent = `${selectedWeaponIndex + 1}. ${weapon.name}`;
  ammoValue.textContent = weapon.reloadEnd > elapsed ? "换弹中" : (empty ? "弹药耗尽" : `${weapon.ammo} / ${weapon.reserve === Infinity ? "∞" : weapon.reserve}`);
  weaponHud.classList.toggle("is-empty", empty);
}

function startReload(weapon) {
  if (weapon.reloadEnd || weapon.ammo >= weapon.magazineSize || weapon.reserve === 0) return;
  weapon.reloadEnd = elapsed + weapon.reloadTime;
}

function updateReloads() {
  weapons.forEach((weapon) => {
    if (!weapon.reloadEnd || elapsed < weapon.reloadEnd) return;
    const amount = weapon.magazineSize - weapon.ammo;
    const loaded = weapon.reserve === Infinity ? amount : Math.min(amount, weapon.reserve);
    weapon.ammo += loaded;
    if (weapon.reserve !== Infinity) weapon.reserve -= loaded;
    weapon.reloadEnd = 0;
  });
}

function selectWeapon(direction) {
  selectedWeaponIndex = (selectedWeaponIndex + direction + weapons.length) % weapons.length;
  updateWeaponHud();
  weaponHud.classList.remove("is-switching");
  void weaponHud.offsetWidth;
  weaponHud.classList.add("is-switching");
}

function triggerEmptyWeaponAlert() {
  weaponHud.classList.remove("is-empty-alert");
  void weaponHud.offsetWidth;
  weaponHud.classList.add("is-empty-alert");
}

function shoot() {
  const weapon = currentWeapon();
  if (weapon.reloadEnd > elapsed) return;
  if (weapon.ammo <= 0) {
    if (weapon.reserve === 0) triggerEmptyWeaponAlert();
    startReload(weapon);
    return;
  }
  const dx = aim.x - player.x, dy = aim.y - player.y;
  const baseAngle = Math.atan2(dy, dx);
  for (let index = 0; index < weapon.pelletCount; index++) {
    const spread = weapon.pelletCount === 1 ? 0 : (Math.random() - .5) * weapon.spread;
    const angle = baseAngle + spread;
    bullets.push({ x: player.x + Math.cos(angle) * (player.radius + 4), y: player.y + Math.sin(angle) * (player.radius + 4), vx: Math.cos(angle) * weapon.bulletSpeed, vy: Math.sin(angle) * weapon.bulletSpeed, damage: weapon.damage });
  }
  weapon.ammo--;
  if (weapon.ammo === 0) startReload(weapon);
  updateWeaponHud();
}

function damageEnemy(enemy, damage) {
  enemy.health -= damage;
  if (enemy.health > 0) return;
  enemy.dead = true;
  score++;
  createDeathEffect(enemy);
  tryDropItem(enemy);
}

function createDeathEffect(enemy) {
  deathEffects.push({ x: enemy.x, y: enemy.y, radius: enemy.type.radius, color: enemy.type.color, age: 0, duration: .5 });
}

function randomItemType() {
  const types = itemConfig.types.filter((type) => type.probability > 0);
  const total = types.reduce((sum, type) => sum + type.probability, 0);
  let roll = Math.random() * total;
  return types.find((type) => (roll -= type.probability) <= 0) || types[0];
}

function tryDropItem(enemy) {
  if (Math.random() > enemy.dropChance) return;
  const type = randomItemType();
  if (type) items.push({ x: enemy.x, y: enemy.y, type, age: 0 });
}

function collectItem(item) {
  const effect = item.type.effect ?? {};
  if (effect.health) playerHealth = Math.min(config.player.health, playerHealth + effect.health);
  if (effect.fireRateMultiplier) {
    fireRateBoostMultiplier = effect.fireRateMultiplier;
    fireRateBoostUntil = Math.max(fireRateBoostUntil, elapsed) + (effect.duration ?? 0);
  }
  if (effect.clearEnemies) {
    const livingEnemies = enemies.filter((enemy) => !enemy.dead);
    score += livingEnemies.length;
    livingEnemies.forEach(createDeathEffect);
    enemies = [];
  }
  item.collected = true;
}

function updatePlayerMovement(dt) {
  const horizontal = (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight") ? 1 : 0) - (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft") ? 1 : 0);
  const vertical = (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown") ? 1 : 0) - (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp") ? 1 : 0);
  const length = Math.hypot(horizontal, vertical);
  if (!length) return;
  const distance = config.player.moveSpeed * dt;
  player.x = Math.max(player.radius, Math.min(world.width - player.radius, player.x + horizontal / length * distance));
  player.y = Math.max(player.radius, Math.min(world.height - player.radius, player.y + vertical / length * distance));
}

function updateHealthDisplay() {
  const health = Math.max(0, Math.ceil(playerHealth));
  healthValue.textContent = health;
  if (health < 20) healthValue.style.color = "#ef5350";
  else if (health < 40) healthValue.style.color = "#ff9800";
  else if (health < 70) healthValue.style.color = "#fdd835";
  else healthValue.style.color = "#7ee3a2";
}

function takePlayerDamage(amount) {
  playerHealth -= amount;
  healthHud.classList.remove("is-hit");
  void healthHud.offsetWidth;
  healthHud.classList.add("is-hit");
}

function update(dt) {
  elapsed += dt; spawnTimer += dt;
  updatePlayerMovement(dt);
  updateReloads();
  if (elapsed >= fireRateBoostUntil) fireRateBoostMultiplier = 1;
  const fireInterval = 1 / Math.max(currentWeapon().fireRate * fireRateBoostMultiplier, .01);
  if (isFiring && elapsed >= nextShotAt) {
    shoot();
    nextShotAt = elapsed + fireInterval;
  }
  const interval = Math.max(config.enemySpawn.minimumInterval, config.enemySpawn.initialInterval - elapsed * config.enemySpawn.accelerationPerSecond);
  while (spawnTimer >= interval) { spawnEnemy(); spawnTimer -= interval; }
  bullets.forEach((bullet) => { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; });
  bullets = bullets.filter((bullet) => bullet.x > -20 && bullet.x < world.width + 20 && bullet.y > -20 && bullet.y < world.height + 20);
  enemies.forEach((enemy) => {
    const desiredHeading = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const turnDifference = shortestAngleDifference(desiredHeading - enemy.heading);
    const turnRatio = Math.min(1, Math.abs(turnDifference) / Math.PI);
    const maximumTurn = 4.2 * dt;
    enemy.heading += Math.sign(turnDifference) * Math.min(Math.abs(turnDifference), maximumTurn);
    const speedMultiplier = 1 - turnRatio * 0.55;
    enemy.x += Math.cos(enemy.heading) * enemy.type.speed * speedMultiplier * dt;
    enemy.y += Math.sin(enemy.heading) * enemy.type.speed * speedMultiplier * dt;
  });
  for (const bullet of bullets) for (const enemy of enemies) {
    if (!bullet.hit && !enemy.dead && Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.type.radius + 3) { bullet.hit = true; damageEnemy(enemy, bullet.damage); }
  }
  bullets = bullets.filter((bullet) => !bullet.hit);
  items.forEach((item) => { item.age += dt; });
  for (const item of items) {
    if (!item.collected && Math.hypot(player.x - item.x, player.y - item.y) < player.radius + itemConfig.radius) collectItem(item);
  }
  items = items.filter((item) => !item.collected && item.age < itemConfig.lifetime);
  deathEffects.forEach((effect) => { effect.age += dt; });
  deathEffects = deathEffects.filter((effect) => effect.age < effect.duration);
  enemies = enemies.filter((enemy) => {
    if (enemy.dead) return false;
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.type.radius + player.radius && elapsed >= enemy.nextAttackAt) {
      takePlayerDamage(enemy.type.attack);
      enemy.nextAttackAt = elapsed + enemy.type.attackInterval;
    }
    return true;
  });
  scoreValue.textContent = score;
  updateHealthDisplay();
  const boostRemaining = Math.ceil(Math.max(0, fireRateBoostUntil - elapsed));
  statusValue.textContent = boostRemaining ? `速射 ${boostRemaining} 秒` : `存活 ${Math.floor(elapsed)} 秒`;
  updateWeaponHud();
  if (playerHealth <= 0) endGame();
}

function draw() {
  ctx.fillStyle = "#315a65";
  ctx.fillRect(0, 0, world.width, world.height);
  bullets.forEach((bullet) => { ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2); ctx.fill(); });
  deathEffects.forEach(drawDeathEffect);
  enemies.forEach(drawZombie);
  items.forEach(drawItem);
  drawPlayer();
  drawCrosshair();
}

function drawDeathEffect(effect) {
  const progress = effect.age / effect.duration;
  const radius = effect.radius * (1 + progress * 1.5);
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = effect.color;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = effect.color;
  for (let index = 0; index < 6; index++) {
    const angle = index / 6 * Math.PI * 2 + progress * 2;
    const distance = radius * (.35 + progress * .55);
    ctx.fillRect(effect.x + Math.cos(angle) * distance - 2, effect.y + Math.sin(angle) * distance - 2, 4, 4);
  }
  ctx.restore();
}

function drawZombie(enemy) {
  const size = enemy.type.radius;
  const angle = enemy.heading;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = "rgba(0, 0, 0, .22)";
  ctx.beginPath(); ctx.ellipse(2, 3, size * .9, size * .52, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = enemy.type.color;
  ctx.lineWidth = Math.max(2, size * .27);
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-size * .46, size * .05); ctx.lineTo(-size * .92, -size * .42); ctx.moveTo(size * .46, size * .05); ctx.lineTo(size * .92, -size * .42); ctx.stroke();
  ctx.fillStyle = enemy.type.color;
  ctx.fillRect(-size * .48, -size * .35, size * .96, size * .9);
  ctx.fillStyle = "#b9d0a5";
  ctx.beginPath(); ctx.arc(0, -size * .68, size * .46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3b1821";
  ctx.fillRect(-size * .2, -size * .78, size * .1, size * .1); ctx.fillRect(size * .1, -size * .78, size * .1, size * .1);
  ctx.restore();
  if (enemy.health < enemy.type.health) {
    const barWidth = Math.max(14, size * 1.65);
    const barHeight = 2;
    const barX = enemy.x - barWidth / 2;
    const barY = enemy.y - size * 1.42;
    ctx.fillStyle = "rgba(18, 23, 24, .75)";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = "#f2f0da";
    ctx.fillRect(barX, barY, barWidth * Math.max(0, enemy.health / enemy.type.health), barHeight);
  }
}

function drawItem(item) {
  const remaining = itemConfig.lifetime - item.age;
  if (remaining <= itemConfig.warningDuration && Math.floor(remaining * 8) % 2 === 0) return;
  const size = itemConfig.radius;
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.fillStyle = item.type.color;
  if (item.type.id === "life") {
    ctx.beginPath(); ctx.arc(-size * .35, -size * .2, size * .42, 0, Math.PI * 2); ctx.arc(size * .35, -size * .2, size * .42, 0, Math.PI * 2); ctx.lineTo(0, size); ctx.closePath(); ctx.fill();
  } else if (item.type.id === "rapidFire") {
    ctx.beginPath(); ctx.moveTo(size * .1, -size); ctx.lineTo(-size * .65, size * .05); ctx.lineTo(-size * .05, size * .05); ctx.lineTo(-size * .15, size); ctx.lineTo(size * .68, -size * .2); ctx.lineTo(size * .08, -size * .2); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#17333d"; ctx.fillRect(-size * .12, -size * .72, size * .24, size * 1.44); ctx.fillRect(-size * .72, -size * .12, size * 1.44, size * .24);
  }
  ctx.restore();
}

function drawPlayer() {
  const angle = Math.atan2(aim.y - player.y, aim.x - player.x);
  const size = player.radius;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = "rgba(0, 0, 0, .3)";
  ctx.beginPath(); ctx.ellipse(2, 4, size * 1.2, size * .72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#203b48";
  ctx.fillRect(-size * .55, -size * .25, size * 1.1, size * 1.12);
  ctx.fillStyle = "#4d7380";
  ctx.fillRect(-size * .4, -size * .22, size * .8, size * .56);
  ctx.fillStyle = "#efc39b";
  ctx.beginPath(); ctx.arc(0, -size * .72, size * .47, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1d272a";
  ctx.fillRect(-size * .5, -size * 1.1, size, size * .28);
  ctx.fillStyle = "#182025";
  ctx.fillRect(-size * .16, -size * 2.1, size * .32, size * 1.55);
  ctx.fillStyle = "#e8d5a3";
  ctx.fillRect(-size * .26, -size * 1.4, size * .52, size * .2);
  ctx.restore();
}

function drawCrosshair() {
  const radius = 15;
  ctx.save();
  ctx.translate(aim.x, aim.y);
  ctx.strokeStyle = "rgba(255, 246, 210, .92)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-radius - 8, 0); ctx.lineTo(-5, 0); ctx.moveTo(radius + 8, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -radius - 8); ctx.lineTo(0, -5); ctx.moveTo(0, radius + 8); ctx.lineTo(0, 5); ctx.stroke();
  ctx.fillStyle = "#e95b53";
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function resetGame() {
  playerHealth = config.player.health; score = 0; elapsed = 0; nextShotAt = 0; spawnTimer = 0; bullets = []; enemies = []; items = []; deathEffects = []; fireRateBoostMultiplier = 1; fireRateBoostUntil = 0; isFiring = false; resetWeapons();
  player.x = world.width / 2; player.y = world.height / 2;
  scoreValue.textContent = score; updateHealthDisplay(); statusValue.textContent = "准备防守"; updateWeaponHud();
}
function startGame() { resetGame(); running = true; overlay.hidden = true; }
function showStartScreen() { resetGame(); running = false; overlayTitle.textContent = "尸潮来袭"; overlayCopy.textContent = "丧尸将从四面八方冲来。使用 WASD 或方向键移动，鼠标瞄准；按住鼠标左键开火。"; startButton.textContent = "开始防守"; overlay.hidden = false; }
function endGame() { running = false; overlayTitle.textContent = "阵地失守"; overlayCopy.textContent = `你击退了 ${score} 名敌人，坚持了 ${Math.floor(elapsed)} 秒。`; startButton.textContent = "再次防守"; overlay.hidden = false; }
function setAim(event) { const rect = canvas.getBoundingClientRect(); aim = { x: (event.clientX - rect.left) / rect.width * world.width, y: (event.clientY - rect.top) / rect.height * world.height }; }
function loop(now) { const dt = Math.min((now - previousTime) / 1000, .05); previousTime = now; if (running) update(dt); draw(); requestAnimationFrame(loop); }

canvas.addEventListener("pointermove", setAim);
canvas.addEventListener("pointerdown", (event) => {
  setAim(event);
  if (event.button === 0) {
    isFiring = true;
    const weapon = currentWeapon();
    if (weapon.ammo === 0 && weapon.reserve === 0 && !weapon.reloadEnd) triggerEmptyWeaponAlert();
  }
});
window.addEventListener("pointerup", (event) => { if (event.button === 0) isFiring = false; });
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  if (event.deltaY) selectWeapon(event.deltaY > 0 ? 1 : -1);
}, { passive: false });
window.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
    pressedKeys.add(event.code);
  }
});
window.addEventListener("keyup", (event) => pressedKeys.delete(event.code));
window.addEventListener("blur", () => pressedKeys.clear());
window.addEventListener("resize", resizeCanvas);
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", showStartScreen);
resizeCanvas();
showStartScreen();
previousTime = performance.now();
requestAnimationFrame(loop);
