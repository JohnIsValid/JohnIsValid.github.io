// 关卡地图配置。
// N = 普通砖块，I = 不会损坏的铁墙，. = 空位。
// levels 数组里有几个对象，游戏就有几关；每个 layout 字符对应一个砖块位置。
window.PING_PONG_LEVEL_CONFIG = {
  startLevel: 1,
  brickSize: {
    width: 61.5,
    height: 22,
    gap: 2,
    top: 72
  },
  levels: [
    {
      id: 1,
      name: "初始阵列",
      layout: [
        "NNNNNNNNNN",
        "NNINNNNINN",
        "NNNNNNNNNN",
        "NINNNNNNIN",
        "NNNNNNNNNN"
      ]
    },
    {
      id: 2,
      name: "双层回廊",
      layout: [
        "NNNN..NNNN",
        "NNINNNNINN",
        ".NNNNNNNN.",
        "NNI....INN",
        "NNNNNNNNNN",
        "..NNNNNN.."
      ]
    },
    {
      id: 3,
      name: "钢铁核心",
      layout: [
        "..NNNNNN..",
        ".NINNNNIN.",
        "NNNNIINNNN",
        "NINNNNNNIN",
        "NNNNIINNNN",
        ".NNNNNNNN.",
        "..NNIINN.."
      ]
    }
  ]
};
