// ステージのデータ。座標の単位はメートル。x は右向き、y は上向き、地面が y = 0。
// 画面の目盛りと数値は、発射台の位置を 0 m として表示する。
// rects は地面の上の台や壁（x, y は左下の角、w は幅、h は高さ）。
// basket は受け取りカゴ（x はカゴの中心、y はカゴの底の高さ、w はカゴの幅）。
// strobe は、飛んでいる間に点を残す時間の間隔 [s]（等しい時間ごとの位置が分かる）。
window.PB = window.PB || {};

PB.stages = [
  { id: 'e1', world: 'earth', basePay: 5000, width: 30, height: 20,
    launch: { x: 2, y: 0 }, basket: { x: 22, y: 0, w: 3 }, rects: [], strobe: 0.1, predictTol: 3 },
  { id: 'e2', world: 'earth', basePay: 6000, width: 32, height: 20,
    launch: { x: 2, y: 0 }, basket: { x: 23, y: 6, w: 3 },
    rects: [ { x: 20, y: 0, w: 6, h: 6 } ], strobe: 0.1, predictTol: 3 },
  { id: 'e3', world: 'earth', basePay: 7000, width: 32, height: 22,
    launch: { x: 2, y: 0 }, basket: { x: 24, y: 0, w: 3 },
    rects: [ { x: 13, y: 0, w: 1, h: 9 } ], strobe: 0.1, predictTol: 3 },
  { id: 'm1', world: 'moon', basePay: 5000, width: 30, height: 20,
    launch: { x: 2, y: 0 }, basket: { x: 22, y: 0, w: 3 }, rects: [], strobe: 0.25, predictTol: 3 },
  { id: 'm2', world: 'moon', basePay: 7000, width: 120, height: 60,
    launch: { x: 4, y: 0 }, basket: { x: 94, y: 0, w: 5 }, rects: [], strobe: 0.5, predictTol: 10 },
  { id: 'm3', world: 'moon', basePay: 9000, width: 110, height: 70,
    launch: { x: 4, y: 0 }, basket: { x: 84, y: 0, w: 5 },
    rects: [ { x: 40, y: 0, w: 4, h: 30 } ], strobe: 0.5, predictTol: 10 }
];
