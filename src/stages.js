// ステージのデータ（仕様書 7章・9章）。座標の単位はメートル。
// x は左から右（画面の横幅が 30 m）、y は下から上。
// walls は四角形（x, y は左下の角、w は幅、h は高さ）。
// 依頼人の一言は texts.js の stageHooks にある。
window.ID = window.ID || {};

ID.stages = [
  {
    id: 'stage0',
    name: '研修',
    basePay: 5000,
    targetTime: 30,
    height: 60,
    noFail: true,          // 失敗なし（どんな速さでも壁で跳ね返る）
    start: { x: 15, y: 5 },
    dock: { x: 15, y: 42, radius: 4, velocity: { x: 0, y: 0 } },
    walls: [
      { x: 8, y: -1, w: 1, h: 62 }, { x: 21, y: -1, w: 1, h: 62 },
      { x: 8, y: -1, w: 14, h: 1 }, { x: 8, y: 60, w: 14, h: 1 }
    ],
    gravitySources: [],
    seed: 1000
  },
  {
    id: 'stage1',
    name: 'まっすぐ配達',
    basePay: 10000,
    targetTime: 30,
    height: 100,
    start: { x: 15, y: 5 },
    dock: { x: 15, y: 95, radius: 2, velocity: { x: 0, y: 0 } },
    walls: [
      { x: 8, y: -1, w: 1, h: 102 }, { x: 21, y: -1, w: 1, h: 102 },
      { x: 8, y: -1, w: 14, h: 1 }, { x: 8, y: 100, w: 14, h: 1 }
    ],
    gravitySources: [],
    seed: 1001
  },
  {
    id: 'stage2',
    name: '曲がり角',
    basePay: 12000,
    targetTime: 35,
    height: 60,
    start: { x: 9, y: 5 },
    dock: { x: 22, y: 54.5, radius: 2, velocity: { x: 0, y: 0 } },
    walls: [
      { x: 3, y: -1, w: 1, h: 62 },      // 左の壁
      { x: 3, y: -1, w: 12, h: 1 },      // 下のふた
      { x: 14, y: -1, w: 1, h: 51 },     // 縦の通路の右の壁
      { x: 14, y: 49, w: 13, h: 1 },     // 横の通路の下の壁
      { x: 3, y: 60, w: 24, h: 1 },      // 上の壁
      { x: 26, y: 49, w: 1, h: 12 }      // 右のつきあたり
    ],
    gravitySources: [],
    seed: 1002
  },
  {
    id: 'stage3',
    name: '精密ドッキング',
    basePay: 12000,
    targetTime: 30,
    height: 70,
    start: { x: 15, y: 5 },
    dock: { x: 15, y: 62, radius: 1, velocity: { x: 0, y: 0 } },
    walls: [
      { x: 10, y: -1, w: 1, h: 68 }, { x: 19, y: -1, w: 1, h: 68 },
      { x: 10, y: -1, w: 10, h: 1 }, { x: 10, y: 66, w: 10, h: 1 }
    ],
    gravitySources: [],
    seed: 1003
  },
  {
    id: 'stage4',
    name: '動くステーション',
    basePay: 15000,
    targetTime: 35,
    height: 70,
    start: { x: 15, y: 5 },
    // 受け取り口は x = 6〜24 m の間を 0.5 m/s で往復する（最初の噴射から動き出す）
    dock: { x: 8, y: 55, radius: 2.5, velocity: { x: 0.5, y: 0 }, bounds: { xMin: 6, xMax: 24 } },
    walls: [
      { x: 0, y: -1, w: 1, h: 72 }, { x: 29, y: -1, w: 1, h: 72 },
      { x: 0, y: -1, w: 30, h: 1 }, { x: 0, y: 70, w: 30, h: 1 }
    ],
    gravitySources: [],
    seed: 1004
  }
];
