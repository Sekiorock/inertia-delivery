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
    rects: [ { x: 40, y: 0, w: 4, h: 30 } ], strobe: 0.5, predictTol: 10 }
];
