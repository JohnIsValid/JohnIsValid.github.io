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
const particles = document.querySelector("#particles");

const RING_SIZE = 120;
const SHRINK_RATE_PER_MS = 0.75 / 4000;
let target = createTarget();
let activeScan = null;
let scanId = 0;
let isUnlocked = false;

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
  const unlockRadius = rect.width * 0.095;
  const success = distance <= unlockRadius;

  if (success) {
    const finalScale = 0.05;
    const scanDuration = Math.round((1 - finalScale) / SHRINK_RATE_PER_MS);
    return { x, y, progress: 1, finalScale, missDistance: 0, scanDuration, success: true };
  }

  const missDistance = distance - unlockRadius;
  // 最终尺寸按距离插值；持续时间由固定收缩速度计算。
  const interpolation = clamp((missDistance - 1) / 54, 0, 1);
  const finalScale = 0.25 + (0.9 - 0.25) * interpolation;
  const scanDuration = Math.round((1 - finalScale) / SHRINK_RATE_PER_MS);
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
}

function revealTargetRange() {
  positionTargetRange();
  targetRange.classList.add("visible");
}

function beginScan(clientX, clientY, pointerId = null) {
  if (activeScan || isUnlocked) return;

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

  activeScan = { id: currentId, pointerId, result, ringAnimation, pointAnimation, barAnimation };

  ringAnimation.finished
    .then(() => finishScan(currentId))
    .catch(() => {});
}

function finishScan(id) {
  if (!activeScan || activeScan.id !== id) return;
  const { result } = activeScan;
  activeScan = null;
  orb.classList.remove("scanning");

  if (result.success) {
    revealTargetRange();
    isUnlocked = true;
    statusText.textContent = "解锁范围匹配";
    hint.textContent = "目标确认";
    window.setTimeout(unlock, 520);
    return;
  }

  scanRing.classList.add("failed");
  feedback.classList.add("failed");
  statusText.textContent = "信号中断";
  hint.textContent = result.missDistance <= 10 ? "非常接近，再换一个相邻位置" : result.missDistance <= 20 ? "位置有偏差，请向正确范围靠近" : "偏离较远，请换一个区域";
}

function cancelScan(message = "扫描已取消，请持续按住") {
  if (!activeScan) return;
  scanId += 1;
  activeScan.ringAnimation.cancel();
  activeScan.pointAnimation.cancel();
  activeScan.barAnimation.cancel();
  activeScan = null;
  orb.classList.remove("scanning");
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
  document.body.classList.add("unlocked");
  unlockLayer.classList.add("active");
  unlockLayer.setAttribute("aria-hidden", "false");
  restartButton.focus({ preventScroll: true });
}

function resetGame() {
  isUnlocked = false;
  target = createTarget();
  positionTargetRange();
  targetRange.classList.remove("visible");
  unlockLayer.classList.remove("active");
  unlockLayer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("unlocked");
  feedback.classList.remove("failed");
  scanRing.style.display = "none";
  scanPoint.style.display = "none";
  scanRing.classList.remove("failed");
  signalBar.getAnimations().forEach((animation) => animation.cancel());
  signalBar.style.width = "0";
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
  if (activeScan?.pointerId === event.pointerId) cancelScan();
});

orb.addEventListener("pointercancel", () => cancelScan());

orb.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  const rect = orb.getBoundingClientRect();
  beginScan(rect.left + rect.width / 2, rect.top + rect.height / 2);
});

restartButton.addEventListener("click", resetGame);

positionTargetRange();

for (let i = 0; i < 28; i += 1) {
  const particle = document.createElement("span");
  particle.style.setProperty("--angle", `${(360 / 28) * i}deg`);
  particle.style.setProperty("--delay", `${(i % 7) * 24}ms`);
  particles.append(particle);
}
