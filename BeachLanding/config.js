// 所有游戏数值均可在此配置。每种敌人的 health 为该类型自身生命值。
window.BEACH_LANDING_CONFIG = {
  player: {
    health: 100,
    radius: 12.5,
    moveSpeed: 220, // 移动速度（像素/秒）
    weapons: [
      { id: "pistol", name: "手枪", magazineSize: 12, reserveAmmo: Infinity, fireRate: 3, bulletSpeed: 920, damage: 2, pelletCount: 1, spread: 0, reloadTime: 0.8 },
      { id: "smg", name: "冲锋枪", magazineSize: 30, reserveAmmo: 0, fireRate: 10, bulletSpeed: 980, damage: 0.5, pelletCount: 1, spread: 0.04, reloadTime: 1.2 },
      { id: "shotgun", name: "霰弹枪", magazineSize: 7, reserveAmmo: 0, fireRate: 1.1, bulletSpeed: 820, damage: 1, pelletCount: 6, spread: 0.42, reloadTime: 1.1 }
    ]
  },
  enemySpawn: {
    initialInterval: 1.05,
    minimumInterval: 0.36,
    accelerationPerSecond: 0.004
  },
  itemDrops: {
    lifetime: 8, // 道具存在时间（秒）
    warningDuration: 2, // 剩余这段时间时开始闪烁
    radius: 10,
    types: [
      { id: "life", name: "生命", color: "#ef6a72", probability: 35, effect: { health: 25 } },
      { id: "purge", name: "清场", color: "#81d4fa", probability: 15, effect: { clearEnemies: true } }
    ]
  },
  enemyTypes: [
    { id: "scout", name: "侦察兵", color: "#f2d16b", health: 1, speed: 92, radius: 8, probability: 62, dropChance: 0.04, attack: 4, attackInterval: 0.8 },
    { id: "assault", name: "突击兵", color: "#ed824c", health: 2, speed: 72, radius: 10.5, probability: 27, dropChance: 0.08, attack: 7, attackInterval: 0.9 },
    { id: "heavy", name: "重装兵", color: "#cd4c57", health: 3, speed: 50, radius: 14, probability: 9, dropChance: 0.14, attack: 12, attackInterval: 1.1 },
    { id: "beast", name: "巨兽", color: "#9c5dd8", health: 4, speed: 33, radius: 19, probability: 2, dropChance: 0.25, attack: 20, attackInterval: 1.3 }
  ]
};
