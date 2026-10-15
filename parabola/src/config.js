// 数値の設定。ここを書き換えるだけで調整できる。
window.PB = window.PB || {};

PB.config = {
  version: '0.5.0',
  publicUrl: 'https://sekiorock.github.io/inertia-delivery/',   // ホーム画面のURL
  homeUrl: '../',              // 「ホームへ」で戻る先
  saveKey: 'parabola-delivery-v1',
  physicsHz: 120,            // 物理の計算の回数 [回/秒]

  // 打ち出し
  vMax: 25,                  // 打ち出しの速さの上限 [m/s]（ステージに vMax があればそちらを使う）
  vMaxDefault: 25,
  speedStep: 0.1,            // 速さの刻み [m/s]
  angleStep: 1,              // 角度の刻み [°]
  aimFullPx: 150,            // 指をこれだけずらすと最大の速さ [px]
  deadZonePx: 8,             // 指を動かしても変わらない「あそび」 [px]

  // 給料
  parcelMass: 2,             // くりまんじゅう（荷物ごと）の質量 [kg]
  energyPrice: 10,           // 打ち出しのエネルギー 1 J あたりの代金 [円]
  precisionBonusMax: 3000,   // 精度ボーナスの上限 [円]（カゴの中心で満額、ふちで0円）
  predictBonusMax: 3000,     // 予測ボーナスの上限 [円]（ずれ0で満額、許容範囲のはしで0円）
  quizBonus: 500,           // 途中停止クイズに正解したときの理解ボーナス [円]（その投てきが成功したとき）
  estimateBonusEach: 1000,   // 見積もりボーナス：1項目あたりの上限 [円]（飛行時間・最高点・着地距離の3項目）
  estimateFullPct: 5,        // ずれがこの % 以内なら満額
  estimateZeroPct: 15,       // ずれがこの % 以上なら0円
  designBonus: 3000,         // 設計ボーナス：最初の1回で届けたとき [円]
  efficiencyBonusMax: 2000,  // 効率ボーナスの上限 [円]（最小エネルギーで投げたとき満額）
  efficiencyZeroRatio: 1.5,  // 最小エネルギーのこの倍以上なら0円
  // 第1章「直線便」
  cartMass: 20,              // 台車（くりまんじゅうごと）の質量 [kg]
  railPrice: 10,             // 電気代：力積 1 N·s あたり [円]（質量 × 速さの変化の合計）
  speedBonusMax: 2000,       // 速達ボーナスの上限 [円]（fastTime までに着けば満額、T 秒で0円）
  lineEstimateEach: 1500,    // 見積もりボーナス：1項目あたり [円]（止まる位置・最大の加速度）
  vStep: 0.5,                // グラフの速さの刻み [m/s]
  star3Ratio: 1.2,           // 手取りが基本給のこの倍以上で星3
  star2Ratio: 1.0,           // この倍以上で星2（成功すれば最低でも星1）

  // 画面
  controlAreaRatio: 0.4,     // 画面下側の操作エリアの割合
  arrowFullPx: 110,          // 速さが上限のときの速度の矢印の長さ [px]
  accArrowPxPerG: 6,         // 加速度 1 m/s² あたりの矢印の長さ [px]
  volume: 0.6,

  colors: { navy: '#1B2A49', white: '#FFFFFF' },

  // 星と斜面。g は重力加速度の大きさ [m/s²]。
  // 斜面（なめらかに滑る場合）の加速度は g sinθ：10° 1.70、30° 4.90、45° 6.93、60° 8.49。
  // slope がある世界は、上から見た斜面のテーブル。g には斜面に沿った加速度 g sinθ を入れる。
  // 火星・木星は、後の段階で使う。
  worlds: {
    rail: { g: 0, rail: true, theme: 'day' },   // 第1章：まっすぐなレール
    slope10: { g: 1.70, slope: 10, theme: 'table' },
    slope30: { g: 4.90, slope: 30, theme: 'table' },
    slope45: { g: 6.93, slope: 45, theme: 'table' },
    slope60: { g: 8.49, slope: 60, theme: 'table' },
    earth: { g: 9.80, theme: 'day' },
    moon:  { g: 1.62, theme: 'space' }
  }
};
