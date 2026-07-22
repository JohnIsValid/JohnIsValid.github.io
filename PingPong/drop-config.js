// 各关卡道具掉落概率配置。
// 数值范围为 0 到 1，例如 0.01 表示每块普通砖有 1% 概率掉落。
window.PING_PONG_DROP_CONFIG = {
  // 未找到对应关卡时使用这组默认值。
  defaults: {
    splitAll: 0.0025,   // 全体弹球分裂为 2 个
    paddleBall: 0.0125, // 从挡板位置发射新球
    widePaddle: 0.015,  // 增加挡板宽度
    fastPaddle: 0.015   // 提升挡板移动速度
  },

  // 增加新关卡时，复制一份关卡对象并修改编号与概率即可。
  levels: {
    1: {
      splitAll: 0.0025,
      paddleBall: 0.0125,
      widePaddle: 0.015,
      fastPaddle: 0.015
    },
    2: {
      splitAll: 0.003,
      paddleBall: 0.014,
      widePaddle: 0.016,
      fastPaddle: 0.016
    },
    3: {
      splitAll: 0.0035,
      paddleBall: 0.015,
      widePaddle: 0.017,
      fastPaddle: 0.017
    }
  }
};
