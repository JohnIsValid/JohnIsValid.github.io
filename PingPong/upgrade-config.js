// 挡板强化配置，所有数值使用游戏内部尺寸或速度单位。
window.PING_PONG_UPGRADE_CONFIG = {
  paddleWidth: {
    initial: 110, // 初始宽度
    increase: 18, // 每次获得加宽道具时增加的宽度
    maximum: 182  // 宽度上限
  },

  paddleSpeed: {
    initial: 650, // 初始移动速度
    increase: 35, // 每次获得加速道具时增加的速度
    maximum: 790  // 移动速度上限
  }
};
