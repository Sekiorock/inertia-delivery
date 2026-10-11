// ステージのデータ（仕様書 7章・9章）。座標の単位はメートル。
// x は左から右、y は下から上。段階1ではステージ1だけ。
window.ID = window.ID || {};

ID.stages = [
  {
    id: 'stage1',
    name: 'まっすぐ配達',
    basePay: 10000,
    targetTime: 30,
    height: 100,
    start: { x: 15, y: 5 },
    dock: { x: 15, y: 95, radius: 2, velocity: { x: 0, y: 0 } },
    walls: [ { x: 8, y: 0, w: 1, h: 100 }, { x: 21, y: 0, w: 1, h: 100 } ],
    gravitySources: [],
    seed: 1001
  }
];
