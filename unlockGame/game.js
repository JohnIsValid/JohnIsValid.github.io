const orb = document.querySelector("#orb");
const scanRing = document.querySelector("#scanRing");
const scanPoint = document.querySelector("#scanPoint");
const targetRange = document.querySelector("#targetRange");
const statusText = document.querySelector("#status");
const hint = document.querySelector("#hint");
const signalBar = document.querySelector("#signalBar");
const feedback = document.querySelector(".feedback");
const unlockLayer = document.querySelector("#unlockLayer");
const restartButton = document.querySelector("#restartButton");
const resultLabel = document.querySelector("#resultLabel");
const resultTitle = document.querySelector("#resultTitle");
const particles = document.querySelector("#particles");
const difficultyInputs = [...document.querySelectorAll('input[name="difficulty"]')];

const RING_SIZE = 120;
const MIN_RING_SCALE = 0.05;
const DIFFICULTIES = {
  1: { shrinkRate: 0.75 / 6000, unlockRadiusRatio: 0.12 },
  2: { shrinkRate: 0.75 / 4000, unlockRadiusRatio: 0.12 },
  3: { shrinkRate: 0.75 / 4000, unlockRadiusRatio: 0.085 },
  4: { shrinkRate: 0.75 / 2600, unlockRadiusRatio: 0.085 },
  5: { shrinkRate: 0.75 / 2600, unlockRadiusRatio: 0.055 },
};
let target = createTarget();
let activeScan = null;
let scanId = 0;
let isUnlocked = false;
let isGameOver = false;
let currentDifficulty = DIFFICULTIES[1];

function createTarget() {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * 0.56;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getScanResult(clientX, clientY) {
  const rect = orb.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const radius = rect.width / 2;
  const targetX = radius + target.x * radius;
  const targetY = radius + target.y * radius;
  const distance = Math.hypot(x - targetX, y - targetY);
  const unlockRadius = rect.width * currentDifficulty.unlockRadiusRatio;
  const success = distance <= unlockRadius;

  if (success) {
    const finalScale = MIN_RING_SCALE;
    const scanDuration = Math.round((1 - finalScale) / currentDifficulty.shrinkRate);
    return { x, y, progress: 1, finalScale, missDistance: 0, scanDuration, success: true };
  }

  const missDistance = distance - unlockRadius;
  // 最终尺寸按距离插值；持续时间由固定收缩速度计算。
  const interpolation = clamp((missDistance - 1) / 54, 0, 1);
  const finalScale = 0.25 + (0.9 - 0.25) * interpolation;
  const scanDuration = Math.round((1 - finalScale) / currentDifficulty.shrinkRate);
  const progress = 1 - finalScale;
  return { x, y, progress, finalScale, missDistance, scanDuration, success: false };
}

function setScanPosition(x, y) {
  scanRing.style.setProperty("--scan-x", `${x}px`);
  scanRing.style.setProperty("--scan-y", `${y}px`);
  scanPoint.style.setProperty("--scan-x", `${x}px`);
  scanPoint.style.setProperty("--scan-y", `${y}px`);
}

function positionTargetRange() {
  targetRange.style.setProperty("--scan-x", `${50 + target.x * 50}%`);
  targetRange.style.setProperty("--scan-y", `${50 + target.y * 50}%`);
  targetRange.style.setProperty(
    "--target-size",
    `${currentDifficulty.unlockRadiusRatio * 200}%`,
  );
}

function setDifficultyControlsDisabled(disabled) {
  difficultyInputs.forEach((input) => {
    input.disabled = disabled;
  });
}

function revealTargetRange() {
  positionTargetRange();
  targetRange.classList.add("visible");
}

function beginScan(clientX, clientY, pointerId = null) {
  if (activeScan || isUnlocked || isGameOver) return;

  targetRange.classList.remove("visible");
  const result = getScanResult(clientX, clientY);
  const currentId = ++scanId;
  const duration = result.scanDuration;
  const finalSize = Math.round(RING_SIZE * result.finalScale);

  scanRing.getAnimations().forEach((animation) => animation.cancel());
  scanPoint.getAnimations().forEach((animation) => animation.cancel());
  scanRing.classList.remove("failed");
  setScanPosition(result.x, result.y);
  scanRing.style.display = "block";
  scanPoint.style.display = "block";
  orb.classList.add("scanning");
  setDifficultyControlsDisabled(true);
  feedback.classList.remove("failed");
  statusText.textContent = "保持接触";
  hint.textContent = "保持按住，不要松开";
  signalBar.getAnimations().forEach((animation) => animation.cancel());
  signalBar.style.width = "0";

  const ringAnimation = scanRing.animate(
    [
      { width: `${RING_SIZE}px`, height: `${RING_SIZE}px`, opacity: 0 },
      { opacity: 1, offset: 0.16 },
      { width: `${finalSize}px`, height: `${finalSize}px`, opacity: 1 },
    ],
    { duration, easing: "linear", fill: "forwards" },
  );

  const pointAnimation = scanPoint.animate(
    [
      { opacity: 0, transform: "scale(0.3)" },
      { opacity: result.success ? 1 : 0.25, transform: "scale(1)" },
    ],
    { duration, easing: "ease-in", fill: "forwards" },
  );

  const barAnimation = signalBar.animate(
    [
      { width: "0%" },
      { width: `${result.progress * 100}%` },
    ],
    { duration, easing: "linear", fill: "forwards" },
  );

  activeScan = {
    id: currentId,
    pointerId,
    result,
    phase: "scanning",
    ringAnimation,
    pointAnimation,
    barAnimation,
  };

  ringAnimation.finished
    .then(() => finishScan(currentId))
    .catch(() => {});
}

function finishScan(id) {
  if (!activeScan || activeScan.id !== id) return;
  const { result } = activeScan;

  if (result.success) {
    activeScan = null;
    orb.classList.remove("scanning");
    revealTargetRange();
    isUnlocked = true;
    statusText.textContent = "解锁范围匹配";
    hint.textContent = "目标确认";
    window.setTimeout(unlock, 520);
    return;
  }

  beginDangerPhase(id);
}

function beginDangerPhase(id) {
  if (!activeScan || activeScan.id !== id) return;

  const { result } = activeScan;
  const startSize = Math.round(RING_SIZE * result.finalScale);
  const minimumSize = Math.round(RING_SIZE * MIN_RING_SCALE);
  const dangerDuration = Math.max(
    180,
    Math.round((result.finalScale - MIN_RING_SCALE) / currentDifficulty.shrinkRate),
  );

  activeScan.phase = "danger";
  scanRing.classList.add("failed");
  feedback.classList.add("failed");
  statusText.textContent = "危险：立即松开";
  hint.textContent = result.missDistance <= 10
    ? "非常接近，松开后再换一个相邻位置"
    : result.missDistance <= 20
      ? "位置有偏差，请立即松开"
      : "偏离较远，请立即松开";

  const ringAnimation = scanRing.animate(
    [
      { width: `${startSize}px`, height: `${startSize}px`, opacity: 1 },
      { width: `${minimumSize}px`, height: `${minimumSize}px`, opacity: 1 },
    ],
    { duration: dangerDuration, easing: "linear", fill: "forwards" },
  );

  const barAnimation = signalBar.animate(
    [
      { width: `${result.progress * 100}%` },
      { width: "100%" },
    ],
    { duration: dangerDuration, easing: "linear", fill: "forwards" },
  );

  activeScan.ringAnimation = ringAnimation;
  activeScan.barAnimation = barAnimation;

  ringAnimation.finished
    .then(() => failGame(id))
    .catch(() => {});
}

function failGame(id) {
  if (!activeScan || activeScan.id !== id || activeScan.phase !== "danger") return;

  activeScan = null;
  isGameOver = true;
  orb.classList.remove("scanning");
  revealTargetRange();
  statusText.textContent = "解锁失败";
  hint.textContent = "未及时松开，核心已锁定";
  signalBar.style.width = "100%";
  resultLabel.textContent = "ACCESS DENIED";
  resultTitle.textContent = "解锁失败";
  restartButton.textContent = "重新开始";
  document.body.classList.add("game-over");
  setDifficultyControlsDisabled(true);
  unlockLayer.classList.add("active", "failure");
  unlockLayer.setAttribute("aria-hidden", "false");
  restartButton.focus({ preventScroll: true });
}

function cancelScan(message = "扫描已取消，请持续按住") {
  if (!activeScan) return;
  scanId += 1;
  scanRing.getAnimations().forEach((animation) => animation.cancel());
  scanPoint.getAnimations().forEach((animation) => animation.cancel());
  signalBar.getAnimations().forEach((animation) => animation.cancel());
  activeScan = null;
  orb.classList.remove("scanning");
  setDifficultyControlsDisabled(false);
  feedback.classList.remove("failed");
  statusText.textContent = "等待接触";
  hint.textContent = message;
  signalBar.style.width = "0";
  scanRing.style.display = "none";
  scanPoint.style.display = "none";
  scanRing.classList.remove("failed");
}

function unlock() {
  isUnlocked = true;
  statusText.textContent = "身份确认";
  hint.textContent = "解锁点匹配成功";
  signalBar.style.width = "100%";
  resultLabel.textContent = "ACCESS GRANTED";
  resultTitle.textContent = "解锁成功";
  restartButton.textContent = "再次挑战";
  document.body.classList.add("unlocked");
  setDifficultyControlsDisabled(true);
  unlockLayer.classList.remove("failure");
  unlockLayer.classList.add("active");
  unlockLayer.setAttribute("aria-hidden", "false");
  restartButton.focus({ preventScroll: true });
}

function resetGame() {
  isUnlocked = false;
  isGameOver = false;
  target = createTarget();
  positionTargetRange();
  targetRange.classList.remove("visible");
  unlockLayer.classList.remove("active");
  unlockLayer.classList.remove("failure");
  unlockLayer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("unlocked");
  document.body.classList.remove("game-over");
  feedback.classList.remove("failed");
  scanRing.style.display = "none";
  scanPoint.style.display = "none";
  scanRing.classList.remove("failed");
  signalBar.getAnimations().forEach((animation) => animation.cancel());
  signalBar.style.width = "0";
  setDifficultyControlsDisabled(false);
  statusText.textContent = "等待接触";
  hint.textContent = "按住球体中的任意一点开始扫描";
  orb.focus({ preventScroll: true });
}

orb.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  orb.setPointerCapture(event.pointerId);
  beginScan(event.clientX, event.clientY, event.pointerId);
});

orb.addEventListener("pointerup", (event) => {
  if (activeScan?.pointerId !== event.pointerId) return;
  cancelScan(activeScan.phase === "danger" ? "已及时松开，请重新选择位置" : undefined);
});

orb.addEventListener("pointercancel", () => cancelScan());

orb.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  const rect = orb.getBoundingClientRect();
  beginScan(rect.left + rect.width / 2, rect.top + rect.height / 2);
});

orb.addEventListener("keyup", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (activeScan?.pointerId !== null) return;
  cancelScan(activeScan.phase === "danger" ? "已及时松开，请重新选择位置" : undefined);
});

restartButton.addEventListener("click", resetGame);

difficultyInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked || activeScan || isUnlocked || isGameOver) return;
    currentDifficulty = DIFFICULTIES[input.value];
    positionTargetRange();
    statusText.textContent = `难度 ${input.value} 已选择`;
    hint.textContent = "按住球体中的任意一点开始扫描";
  });
});

positionTargetRange();

for (let i = 0; i < 28; i += 1) {
  const particle = document.createElement("span");
  particle.style.setProperty("--angle", `${(360 / 28) * i}deg`);
  particle.style.setProperty("--delay", `${(i % 7) * 24}ms`);
  particles.append(particle);
}
