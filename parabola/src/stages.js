// ステージのデータ。座標の単位はメートル。x は右向き、y は上向き、地面が y = 0。
// 画面の目盛りと数値は、発射台の位置を 0 m として表示する。
// rects は地面の上の台や壁（x, y は左下の角、w は幅、h は高さ）。
// basket は受け取りカゴ（x はカゴの中心、y はカゴの底の高さ、w はカゴの幅）。
// quiz は体感の段階の途中停止クイズ。at は止める瞬間（rise：上昇の途中、apex：最高点、descent：下降の途中）、
// ask は問い（vel：速度の向き、acc：加速度の向き、accMag：加速度の大きさ）、answer は正解、explain は説明の文言。
// strobe は、飛んでいる間に点を残す時間の間隔 [s]（等しい時間ごとの位置が分かる）。
window.PB = window.PB || {};

// chapter はステージ選択の章。章の最初のステージは、いつでも遊べる。
// 第2章（斜面テーブル便）は上から見た斜面。y は斜面に沿って上向きの距離、下の手すりが y = 0。
// kuriR はくりまんじゅうの見た目の半径 [m]、vMax は打ち出しの速さの上限 [m/s]。
// topRail があると、テーブルの上の端（y = height）を越えたら落ちて失敗になる。
PB.stages = [
  // 第1章（直線便）：targets は止まる位置の並び（最後が終点）、T はグラフの長さ [s]、
  // vMin〜vMax はグラフの速さの範囲 [m/s]、aMax は出してよい加速度の大きさ、tol は止まる位置の許容範囲 [m]。
  { id: 'l1', chapter: 1, world: 'rail', rail: true, basePay: 6000, width: 22, targets: [16], T: 10,
    vMin: 0, vMax: 6, aMax: 2, tol: 0.5, fastTime: 6,
    quiz: [ { at: 'brake', ask: 'acc', answer: 'w', explain: 'l1' } ] },
  { id: 'l2', chapter: 1, world: 'rail', rail: true, basePay: 6500, width: 24, targets: [18], T: 12,
    vMin: 0, vMax: 4, aMax: 1, tol: 0.5, fastTime: 9,
    quiz: [ { at: 'cruise', ask: 'accMag', answer: '0', options: ['1.0', '0.5', '0'], explain: 'l2' } ] },
  { id: 'l3', chapter: 1, world: 'rail', rail: true, basePay: 7000, width: 30, targets: [25], T: 10,
    vMin: 0, vMax: 6, aMax: 2, tol: 0.5, fastTime: 7.5,
    quiz: [ { at: 'speedup', ask: 'acc', answer: 'e', explain: 'l3' } ] },
  { id: 'l4', chapter: 1, world: 'rail', rail: true, basePay: 8000, width: 18, targets: [12, 4], T: 14,
    vMin: -4, vMax: 4, aMax: 2, tol: 0.5, fastTime: 11, modes: ['feel', 'predict', 'estimate'],
    quiz: [ { at: 'reverse', ask: 'vel', answer: 'w', explain: 'l4' } ] },
  { id: 's10', chapter: 2, world: 'slope10', basePay: 4000, width: 8, height: 5, vMax: 8, kuriR: 0.2, topRail: true,
    quiz: [ { at: 'apex', ask: 'accMag', answer: '1.70', options: ['9.80', '1.70', '0'], explain: 's10' } ],
    launch: { x: 0.5, y: 0 }, basket: { x: 6, y: 0, w: 0.8 }, rects: [], strobe: 0.2, predictTol: 0.8 },
  { id: 's30', chapter: 2, world: 'slope30', basePay: 4500, width: 8, height: 5, vMax: 8, kuriR: 0.2, topRail: true,
    quiz: [ { at: 'rise', ask: 'acc', answer: 's', explain: 's30' } ],
    launch: { x: 0.5, y: 0 }, basket: { x: 6, y: 0, w: 0.8 }, rects: [], strobe: 0.1, predictTol: 0.8 },
  { id: 's45', chapter: 2, world: 'slope45', basePay: 5000, width: 8, height: 5, vMax: 10, kuriR: 0.2, topRail: true,
    quiz: [ { at: 'apex', ask: 'vel', answer: 'e', explain: 's45' } ],
    launch: { x: 0.5, y: 0 }, basket: { x: 6.25, y: 1.2, w: 0.8 },
    rects: [ { x: 5.5, y: 0, w: 1.5, h: 1.2 } ], strobe: 0.1, predictTol: 0.8 },
  { id: 's60', chapter: 2, world: 'slope60', basePay: 5500, width: 8, height: 5, vMax: 10, kuriR: 0.2, topRail: true,
    quiz: [ { at: 'apex', ask: 'accMag', answer: '8.49', options: ['9.80', '8.49', '4.90'], explain: 's60' } ],
    launch: { x: 0.5, y: 0 }, basket: { x: 6.5, y: 0, w: 0.8 },
    rects: [ { x: 3.4, y: 0, w: 0.2, h: 1.6 } ], strobe: 0.1, predictTol: 0.8 },
  { id: 'e1', chapter: 3, quiz: [ { at: 'apex', ask: 'vel', answer: 'e', explain: 'e1a' }, { at: 'apex', ask: 'acc', answer: 's', explain: 'e1b' } ],
    world: 'earth', basePay: 5000, width: 30, height: 20,
    launch: { x: 2, y: 0 }, basket: { x: 22, y: 0, w: 3 }, rects: [], strobe: 0.1, predictTol: 3 },
  { id: 'e2', chapter: 3, quiz: [ { at: 'rise', ask: 'acc', answer: 's', explain: 'e2' } ],
    world: 'earth', basePay: 6000, width: 32, height: 20,
    launch: { x: 2, y: 0 }, basket: { x: 23, y: 6, w: 3 },
    rects: [ { x: 20, y: 0, w: 6, h: 6 } ], strobe: 0.1, predictTol: 3 },
  { id: 'e3', chapter: 3, quiz: [ { at: 'descent', ask: 'vel', answer: 'se', explain: 'e3' } ],
    world: 'earth', basePay: 7000, width: 32, height: 22,
    launch: { x: 2, y: 0 }, basket: { x: 24, y: 0, w: 3 },
    rects: [ { x: 13, y: 0, w: 1, h: 9 } ], strobe: 0.1, predictTol: 3 },
  { id: 'm1', chapter: 3, quiz: [ { at: 'apex', ask: 'accMag', answer: '1.62', options: ['9.80', '1.62', '0'], explain: 'm1' } ],
    world: 'moon', basePay: 5000, width: 30, height: 20,
    launch: { x: 2, y: 0 }, basket: { x: 22, y: 0, w: 3 }, rects: [], strobe: 0.25, predictTol: 3 },
  { id: 'm2', chapter: 3, quiz: [ { at: 'apex', ask: 'acc', answer: 's', explain: 'm2' } ],
    world: 'moon', basePay: 7000, width: 120, height: 60,
    launch: { x: 4, y: 0 }, basket: { x: 94, y: 0, w: 5 }, rects: [], strobe: 0.5, predictTol: 10 },
  { id: 'm3', chapter: 3, quiz: [ { at: 'rise', ask: 'vel', answer: 'ne', explain: 'm3' } ],
    world: 'moon', basePay: 9000, width: 110, height: 70,
    launch: { x: 4, y: 0 }, basket: { x: 84, y: 0, w: 5 },
    rects: [ { x: 40, y: 0, w: 4, h: 30 } ], strobe: 0.5, predictTol: 10 },
  // 火星（g = 3.71 m/s²）：遠くまで飛ぶぶん、エネルギー代の単価を 1 J あたり 6 円にしている
  { id: 'ma1', chapter: 3, world: 'mars', basePay: 5500, energyPrice: 6, width: 64, height: 32,
    quiz: [ { at: 'apex', ask: 'accMag', answer: '3.71', options: ['9.80', '3.71', '1.62'], explain: 'ma1' } ],
    launch: { x: 2, y: 0 }, basket: { x: 54.8, y: 0, w: 4 }, rects: [], strobe: 0.25, predictTol: 6 },
  { id: 'ma2', chapter: 3, world: 'mars', basePay: 6000, energyPrice: 6, width: 64, height: 36,
    quiz: [ { at: 'rise', ask: 'acc', answer: 's', explain: 'ma2' } ],
    launch: { x: 2, y: 0 }, basket: { x: 47, y: 12, w: 4 },
    rects: [ { x: 42, y: 0, w: 10, h: 12 } ], strobe: 0.25, predictTol: 6 },
  { id: 'ma3', chapter: 3, world: 'mars', basePay: 7000, energyPrice: 6, width: 90, height: 40,
    quiz: [ { at: 'descent', ask: 'vel', answer: 'se', explain: 'ma3' } ],
    launch: { x: 3, y: 15 }, basket: { x: 60, y: 0, w: 5 },
    rects: [ { x: 0, y: 0, w: 6, h: 15 } ], strobe: 0.25, predictTol: 6 },
  // 木星（g = 24.79 m/s²）：雲の上に浮かぶステーションのデッキ
  // 重力が強く速く投げる必要があるので、エネルギー代の単価を 1 J あたり 4 円に下げている（木星手当）
  { id: 'j1', chapter: 3, world: 'jupiter', basePay: 6000, energyPrice: 4, width: 16, height: 12,
    quiz: [ { at: 'apex', ask: 'accMag', answer: '24.79', options: ['9.80', '24.79', '2.48'], explain: 'j1' } ],
    launch: { x: 1, y: 0 }, basket: { x: 11, y: 0, w: 1.5 }, rects: [], strobe: 0.05, predictTol: 1.5 },
  { id: 'j2', chapter: 3, world: 'jupiter', basePay: 6500, energyPrice: 4, width: 16, height: 12,
    quiz: [ { at: 'apex', ask: 'vel', answer: 'e', explain: 'j2' } ],
    launch: { x: 1, y: 0 }, basket: { x: 12, y: 4, w: 1.5 },
    rects: [ { x: 10.5, y: 0, w: 3.5, h: 4 } ], strobe: 0.05, predictTol: 1.5 },
  { id: 'j3', chapter: 3, world: 'jupiter', basePay: 7500, energyPrice: 4, width: 16, height: 14,
    quiz: [ { at: 'descent', ask: 'acc', answer: 's', explain: 'j3' } ],
    launch: { x: 1, y: 0 }, basket: { x: 10.5, y: 0, w: 1.5 },
    rects: [ { x: 7, y: 0, w: 0.4, h: 5 }, { x: 11.6, y: 0, w: 0.4, h: 8 } ], strobe: 0.05, predictTol: 1.5 }
];
