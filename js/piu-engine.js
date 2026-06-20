/* ===========================================================
   Piu Engine — 核心游戏逻辑 (无 DOM 依赖)
   棋盘状态 · 物理模拟 · 回合管理 · AI 决策 · 得分计算
   =========================================================== */

const PiuEngine = (() => {
  'use strict';

  /* ---- 常量 ---- */
  const COLS = 20;
  const ROWS = 12;
  const FRICTION_PER_FRAME = 0.985;
  const WALL_BOUNCE = 0.82;
  const PIECE_BOUNCE = 0.74;
  const STOP_THRESHOLD = 0.05;
  const MAX_FORCE = 16;
  const MIN_DRAG = 10;

  /* ---- 格子类型 ---- */
  const TILE = {
    EMPTY: 0,
    TARGET_CENTER: 1,
    TARGET_OUTER: 2,
    SCORE_TILE: 3,
    TRAP: 4,
    SPEED: 5,
    SLOW: 6,
  };

  const SCORE_MAP = {
    [TILE.TARGET_CENTER]: 5,
    [TILE.TARGET_OUTER]: 3,
    [TILE.SCORE_TILE]: 1,
    [TILE.TRAP]: -2,
  };

  /* ---- 地图生成 ---- */

  function emptyTiles() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function generateBasicMap() {
    const t = emptyTiles();
    // 中心目标区 (中心区域 3×3)
    t[5][9] = TILE.TARGET_CENTER;  t[5][10] = TILE.TARGET_CENTER;
    t[6][9] = TILE.TARGET_CENTER;  t[6][10] = TILE.TARGET_CENTER;
    t[5][8] = TILE.TARGET_OUTER;   t[5][11] = TILE.TARGET_OUTER;
    t[6][8] = TILE.TARGET_OUTER;   t[6][11] = TILE.TARGET_OUTER;
    t[4][9] = TILE.TARGET_OUTER;   t[4][10] = TILE.TARGET_OUTER;
    t[7][9] = TILE.TARGET_OUTER;   t[7][10] = TILE.TARGET_OUTER;
    // 角落得分格
    t[3][3] = TILE.SCORE_TILE;  t[3][16] = TILE.SCORE_TILE;
    t[8][5] = TILE.SCORE_TILE;  t[8][14] = TILE.SCORE_TILE;
    // 边界陷阱
    t[4][0] = TILE.TRAP;  t[4][19] = TILE.TRAP;
    t[7][0] = TILE.TRAP;  t[7][19] = TILE.TRAP;
    return t;
  }

  function generateObstacleMap() {
    const t = emptyTiles();
    // 中心目标
    t[5][9] = TILE.TARGET_CENTER;  t[5][10] = TILE.TARGET_CENTER;
    t[6][9] = TILE.TARGET_OUTER;   t[6][10] = TILE.TARGET_OUTER;
    // 白色挡板障碍 (BARRIER 用 -1 标记，渲染层处理)
    // 左侧竖挡板
    for (let r = 3; r <= 8; r++) { t[r][4] = -1; }
    // 右侧竖挡板
    for (let r = 3; r <= 8; r++) { t[r][15] = -1; }
    // 中间横挡板 (留出目标通道)
    for (let c = 0; c <= 7; c++) { t[6][c] = -1; }
    for (let c = 13; c < COLS; c++) { t[6][c] = -1; }
    // 得分格
    t[3][9] = TILE.SCORE_TILE;  t[3][10] = TILE.SCORE_TILE;
    t[8][9] = TILE.SCORE_TILE;  t[8][10] = TILE.SCORE_TILE;
    // 陷阱
    t[4][0] = TILE.TRAP;  t[4][19] = TILE.TRAP;
    t[7][0] = TILE.TRAP;  t[7][19] = TILE.TRAP;
    return t;
  }

  function generateSpecialMap() {
    const t = emptyTiles();
    // 中心目标
    t[5][9] = TILE.TARGET_CENTER;  t[5][10] = TILE.TARGET_CENTER;
    t[6][9] = TILE.TARGET_OUTER;   t[6][10] = TILE.TARGET_OUTER;
    // 加速格
    t[4][5] = TILE.SPEED;   t[4][14] = TILE.SPEED;
    t[7][5] = TILE.SPEED;   t[7][14] = TILE.SPEED;
    // 减速格
    t[3][9] = TILE.SLOW;    t[3][10] = TILE.SLOW;
    t[8][9] = TILE.SLOW;    t[8][10] = TILE.SLOW;
    // 黄色特殊得分格
    t[3][3] = TILE.SCORE_TILE;   t[3][16] = TILE.SCORE_TILE;
    t[5][2] = TILE.SCORE_TILE;   t[5][17] = TILE.SCORE_TILE;
    t[6][2] = TILE.SCORE_TILE;   t[6][17] = TILE.SCORE_TILE;
    t[8][3] = TILE.SCORE_TILE;   t[8][16] = TILE.SCORE_TILE;
    // 陷阱
    t[4][0] = TILE.TRAP;  t[4][19] = TILE.TRAP;
    t[7][0] = TILE.TRAP;  t[7][19] = TILE.TRAP;
    return t;
  }

  const MAPS = {
    basic:    { name: '新手场', tiles: generateBasicMap() },
    obstacle: { name: '障碍场', tiles: generateObstacleMap() },
    special:  { name: '道具场', tiles: generateSpecialMap() },
  };

  /* ---- 游戏状态工厂 ---- */

  function createGame(config = {}) {
    const cfg = {
      mapId: 'basic',
      rounds: 5,
      shotsPerTurn: 1,
      turnTimeLimit: 0,
      boundaryRule: 'bounce',
      aiDifficulty: 'medium',
      mode: 'ai',
      ...config,
    };
    const map = MAPS[cfg.mapId] || MAPS.basic;

    return {
      config: cfg,
      map: map,
      board: { cols: COLS, rows: ROWS, tiles: cloneTiles(map.tiles) },
      pieces: [],
      currentPlayer: 1,
      turnNumber: 0,
      scores: [0, 0],
      piecesRemaining: [cfg.rounds, cfg.rounds],
      phase: 'aiming',      // aiming | simulating | scoring | switching | gameover
      activePiece: null,
      roundLog: [],
      winner: null,
      tieBreak: false,
      comboCount: 0,
    };
  }

  function cloneTiles(tiles) {
    return tiles.map(row => [...row]);
  }

  /* ---- 棋子操作 ---- */

  function placePiece(state, player, col, row) {
    const piece = {
      id: `p${player}_${state.piecesRemaining[player - 1]}`,
      team: player,
      x: col,
      y: row,
      vx: 0,
      vy: 0,
      radius: 0.4,
      active: true,
      launched: false,
    };
    state.pieces.push(piece);
    state.activePiece = piece;
    return piece;
  }

  function launchPiece(state, fx, fy) {
    if (!state.activePiece || state.phase !== 'aiming') return false;
    const p = state.activePiece;
    const force = Math.sqrt(fx * fx + fy * fy);
    if (force < MIN_DRAG) return false;
    const clampedForce = Math.min(force, MAX_FORCE);
    const scale = clampedForce / force;
    p.vx = fx * scale * 0.055;
    p.vy = fy * scale * 0.055;
    p.launched = true;
    state.phase = 'simulating';
    state.comboCount = 0;
    return true;
  }

  /* ---- 物理模拟 (每帧调用一次) ---- */

  function simulateFrame(state, dt = 1) {
    if (state.phase !== 'simulating') return null;

    let allStopped = true;
    const events = []; // collisions, tile triggers

    for (const p of state.pieces) {
      if (!p.active || !p.launched) continue;

      // 应用速度
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 摩擦
      p.vx *= FRICTION_PER_FRAME;
      p.vy *= FRICTION_PER_FRAME;

      // 墙体碰撞 (反弹)
      if (state.config.boundaryRule === 'bounce') {
        if (p.x - p.radius < 0)      { p.x = p.radius;      p.vx *= -WALL_BOUNCE; events.push({ type: 'wall', piece: p }); }
        if (p.x + p.radius > COLS-1)  { p.x = COLS-1 - p.radius; p.vx *= -WALL_BOUNCE; events.push({ type: 'wall', piece: p }); }
        if (p.y - p.radius < 0)       { p.y = p.radius;      p.vy *= -WALL_BOUNCE; events.push({ type: 'wall', piece: p }); }
        if (p.y + p.radius > ROWS-1)  { p.y = ROWS-1 - p.radius; p.vy *= -WALL_BOUNCE; events.push({ type: 'wall', piece: p }); }
      } else {
        // 出界移除
        if (p.x - p.radius < 0 || p.x + p.radius > COLS-1 ||
            p.y - p.radius < 0 || p.y + p.radius > ROWS-1) {
          p.active = false;
          events.push({ type: 'out_of_bounds', piece: p });
          continue;
        }
      }

      // 障碍碰撞
      const col = Math.round(p.x);
      const row = Math.round(p.y);
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        const tile = state.board.tiles[row][col];
        if (tile === -1) {
          // 反弹
          const cx = col + 0.5, cy = row + 0.5;
          const dx = p.x - cx, dy = p.y - cy;
          if (Math.abs(dx) > Math.abs(dy)) {
            p.vx *= -WALL_BOUNCE;
            p.x = dx > 0 ? col + 1 + p.radius : col - p.radius;
          } else {
            p.vy *= -WALL_BOUNCE;
            p.y = dy > 0 ? row + 1 + p.radius : row - p.radius;
          }
          events.push({ type: 'barrier', piece: p, col, row });
        }
      }

      // 速度检查
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > STOP_THRESHOLD) {
        allStopped = false;
      }
    }

    // 棋子间碰撞
    for (let i = 0; i < state.pieces.length; i++) {
      for (let j = i + 1; j < state.pieces.length; j++) {
        const a = state.pieces[i], b = state.pieces[j];
        if (!a.active || !b.active) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;
        if (dist < minDist && dist > 0.001) {
          // 分离
          const overlap = minDist - dist;
          const nx = dx / dist, ny = dy / dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          // 弹性碰撞 (1D 近似沿法线方向)
          const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
          const dvDotN = dvx * nx + dvy * ny;
          if (dvDotN > 0) {
            const impulse = dvDotN * (1 + PIECE_BOUNCE) * 0.5;
            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
          }
          events.push({ type: 'piece_collision', a, b });
          allStopped = false;
        }
      }
    }

    // 所有棋子停止 → 进入结算
    if (allStopped) {
      state.phase = 'scoring';
    }

    return { allStopped, events };
  }

  /* ---- 得分结算 ---- */

  function settleScore(state) {
    const lastPiece = state.activePiece;
    if (!lastPiece) return { score: 0, details: [] };

    let score = 0;
    const details = [];
    const col = Math.round(lastPiece.x);
    const row = Math.round(lastPiece.y);

    // 检查落点格子
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      const tile = state.board.tiles[row][col];
      const pts = SCORE_MAP[tile] || 0;
      if (pts !== 0) {
        score += pts;
        details.push({ type: 'tile', tile, points: pts });
      }
    }

    // 检查是否出界
    if (!lastPiece.active) {
      score += -1;
      details.push({ type: 'out_of_bounds', points: -1 });
    }

    // 击出对方棋子
    for (const p of state.pieces) {
      if (p.team !== lastPiece.team && !p.active && p !== lastPiece) {
        const px = Math.round(p.x), py = Math.round(p.y);
        if (px < 0 || px >= COLS || py < 0 || py >= ROWS) {
          score += 2;
          details.push({ type: 'knockout', points: 2, target: p });
        }
      }
    }

    state.scores[lastPiece.team - 1] += score;
    state.roundLog.push({
      turn: state.turnNumber,
      player: lastPiece.team,
      piece: lastPiece.id,
      score,
      details,
      finalPos: { x: lastPiece.x, y: lastPiece.y },
    });

    return { score, details };
  }

  /* ---- 回合推进 ---- */

  function nextTurn(state) {
    state.turnNumber++;
    const prevPlayer = state.currentPlayer;

    // 检查是否所有回合结束
    const totalShots = state.config.rounds * 2; // 双方各 N 回合
    if (state.turnNumber >= totalShots) {
      state.phase = 'gameover';
      determineWinner(state);
      return state;
    }

    // 切换玩家
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
    state.activePiece = null;
    state.phase = state.currentPlayer === 1 || state.config.mode === 'local'
      ? 'aiming' : 'aiming';

    return state;
  }

  function determineWinner(state) {
    const [s1, s2] = state.scores;
    if (s1 > s2) state.winner = 1;
    else if (s2 > s1) state.winner = 2;
    else {
      // 平局: 检查谁离中心更近
      let d1 = Infinity, d2 = Infinity;
      for (const p of state.pieces) {
        const dx = p.x - COLS/2, dy = p.y - ROWS/2;
        const d = dx*dx + dy*dy;
        if (p.team === 1 && d < d1) d1 = d;
        if (p.team === 2 && d < d2) d2 = d;
      }
      if (d1 < d2) state.winner = 1;
      else if (d2 < d1) state.winner = 2;
      else state.winner = 0; // 真平局
    }
  }

  /* ---- AI 决策 ---- */

  function getAIAction(state) {
    const difficulty = state.config.aiDifficulty;
    const aiPlayer = state.currentPlayer; // should be 2

    // 找到所有可能的目标
    const targets = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = state.board.tiles[r][c];
        if (t > 0 && t !== TILE.TRAP) {
          targets.push({
            col: c, row: r,
            value: SCORE_MAP[t] || 0,
          });
        }
      }
    }

    if (targets.length === 0) {
      // 随机方向
      return randomAim(difficulty);
    }

    // 排序: 高分优先
    targets.sort((a, b) => b.value - a.value);

    let target;
    if (difficulty === 'easy') {
      // 简单: 随机选一个目标
      target = targets[Math.floor(Math.random() * targets.length)];
    } else if (difficulty === 'medium') {
      // 中等: 选高分目标
      const topN = targets.filter(t => t.value >= targets[0].value * 0.6);
      target = topN[Math.floor(Math.random() * topN.length)];
    } else {
      // 困难: 选最佳目标
      target = targets[0];
    }

    // 计算从己方起始区到目标的弹射方向
    const startY = aiPlayer === 2 ? 1 : ROWS - 2;
    const startX = COLS / 2;
    const dx = target.col - startX;
    const dy = target.row - startY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // 基础力向量
    let fx = dx / (dist || 1) * (MAX_FORCE * 0.7);
    let fy = dy / (dist || 1) * (MAX_FORCE * 0.7);

    // 难度误差
    const errorAmount = {
      easy: MAX_FORCE * 0.35,
      medium: MAX_FORCE * 0.15,
      hard: MAX_FORCE * 0.05,
    }[difficulty] || MAX_FORCE * 0.15;

    fx += (Math.random() - 0.5) * errorAmount * 2;
    fy += (Math.random() - 0.5) * errorAmount * 2;

    return { fx, fy, target };
  }

  function randomAim(difficulty) {
    const angle = Math.random() * Math.PI * 2;
    const force = MAX_FORCE * (0.4 + Math.random() * 0.4);
    return {
      fx: Math.cos(angle) * force,
      fy: Math.sin(angle) * force,
      target: null,
    };
  }

  /* ---- 辅助函数 ---- */

  function getTileAt(state, col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return state.board.tiles[row][col];
  }

  function isInStartingZone(player, col, row) {
    if (player === 1) {
      return row >= ROWS - 2 && col >= 7 && col <= 12;
    } else {
      return row <= 1 && col >= 7 && col <= 12;
    }
  }

  /* ---- 公开 API ---- */
  return {
    TILE, SCORE_MAP,
    MAPS, COLS, ROWS,
    FRICTION_PER_FRAME, WALL_BOUNCE, PIECE_BOUNCE,
    STOP_THRESHOLD, MAX_FORCE, MIN_DRAG,

    createGame,
    placePiece,
    launchPiece,
    simulateFrame,
    settleScore,
    nextTurn,
    determineWinner,
    getAIAction,
    getTileAt,
    isInStartingZone,
  };
})();
