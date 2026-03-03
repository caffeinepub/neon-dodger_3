import React, { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = "idle" | "running" | "gameover";

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

interface Obstacle {
  x: number;
  y: number;
  radius: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
  life: number;
}

interface Keys {
  ArrowLeft: boolean;
  ArrowRight: boolean;
  ArrowUp: boolean;
  ArrowDown: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_SIZE = 32;
const PLAYER_SPEED = 280;
const OBSTACLE_RADIUS = 18;
const OBSTACLE_INITIAL_SPEED = 160;
const OBSTACLE_SPEED_INCREMENT = 8;
const OBSTACLE_INITIAL_INTERVAL = 900;
const OBSTACLE_INTERVAL_DECREMENT = 30;
const OBSTACLE_MIN_INTERVAL = 200;
const PARTICLE_COUNT = 30;
const PARTICLE_LIFE = 0.6;
const PARTICLE_COLORS = ["#00aaff", "#ff2244", "#ffffff", "#ffff00", "#00ffcc"];
const GRID_SIZE = 60;
const GRID_COLOR = "rgba(0,255,200,0.06)";

// ─── Pure Draw Functions (outside component) ──────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  offset: number,
) {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let x = 0; x <= w + GRID_SIZE; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  const scrollOffset = offset % GRID_SIZE;
  for (let y = scrollOffset - GRID_SIZE; y <= h + GRID_SIZE; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player) {
  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#00aaff";
  ctx.fillStyle = "#00aaff";
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#ffffff";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(player.x + 4, player.y + 4, player.width - 8, player.height - 8);
  ctx.restore();
}

function drawObstacles(ctx: CanvasRenderingContext2D, obstacles: Obstacle[]) {
  for (const obs of obstacles) {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ff2244";
    ctx.fillStyle = "#ff2244";
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "rgba(255,180,180,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, obs.radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0, p.radius), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawScore(ctx: CanvasRenderingContext2D, score: number, w: number) {
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#00ffcc";
  ctx.fillStyle = "#00ffcc";
  ctx.font = "bold 26px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(`SCORE: ${score}`, w / 2, 44);
  ctx.restore();
}

function checkCollision(player: Player, obstacle: Obstacle): boolean {
  const expandedLeft = player.x - obstacle.radius;
  const expandedRight = player.x + player.width + obstacle.radius;
  const expandedTop = player.y - obstacle.radius;
  const expandedBottom = player.y + player.height + obstacle.radius;
  return (
    obstacle.x >= expandedLeft &&
    obstacle.x <= expandedRight &&
    obstacle.y >= expandedTop &&
    obstacle.y <= expandedBottom
  );
}

function createExplosion(cx: number, cy: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 220;
    const color =
      PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 3,
      alpha: 1,
      color,
      life: 0,
    });
  }
  return particles;
}

function createObstacle(w: number, elapsedSeconds: number): Obstacle {
  const x = OBSTACLE_RADIUS + Math.random() * (w - OBSTACLE_RADIUS * 2);
  const steps = Math.floor(elapsedSeconds / 5);
  const speed = OBSTACLE_INITIAL_SPEED + steps * OBSTACLE_SPEED_INCREMENT;
  return { x, y: -OBSTACLE_RADIUS, radius: OBSTACLE_RADIUS, speed };
}

function renderStaticBackground(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let x = 0; x <= w + GRID_SIZE; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h + GRID_SIZE; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

// ─── NeonDodger Component ─────────────────────────────────────────────────────

export default function NeonDodger() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // React state for DOM overlay only
  const [gamePhase, setGamePhase] = useState<GamePhase>("idle");
  const [displayScore, setDisplayScore] = useState(0);

  // All mutable game state in refs
  const phaseRef = useRef<GamePhase>("idle");
  const playerRef = useRef<Player>({
    x: 0,
    y: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    speed: PLAYER_SPEED,
  });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const spawnTimerRef = useRef(0);
  const keysRef = useRef<Keys>({
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
  });
  const gridOffsetRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  // Stable setter refs
  const setDisplayScoreRef = useRef(setDisplayScore);
  const setGamePhaseRef = useRef(setGamePhase);
  setDisplayScoreRef.current = setDisplayScore;
  setGamePhaseRef.current = setGamePhase;

  // Game loop stored in ref so it always sees fresh state without dep-array issues
  const gameLoopRef = useRef<((timestamp: number) => void) | null>(null);

  // Re-assign every render so it always captures latest refs
  useEffect(() => {
    gameLoopRef.current = (timestamp: number) => {
      if (phaseRef.current !== "running") return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      elapsedRef.current += dt;
      const score = Math.floor(elapsedRef.current);
      if (score !== scoreRef.current) {
        scoreRef.current = score;
        setDisplayScoreRef.current(score);
      }

      gridOffsetRef.current += dt * 80;

      // Move player
      const player = playerRef.current;
      const touch = touchRef.current;
      if (touch) {
        const dx = touch.x - (player.x + player.width / 2);
        const dy = touch.y - (player.y + player.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 4) {
          const moveSpeed = Math.min(player.speed * dt, dist);
          player.x += (dx / dist) * moveSpeed;
          player.y += (dy / dist) * moveSpeed;
        }
      } else {
        const keys = keysRef.current;
        if (keys.ArrowLeft) player.x -= player.speed * dt;
        if (keys.ArrowRight) player.x += player.speed * dt;
        if (keys.ArrowUp) player.y -= player.speed * dt;
        if (keys.ArrowDown) player.y += player.speed * dt;
      }
      player.x = Math.max(0, Math.min(w - player.width, player.x));
      player.y = Math.max(0, Math.min(h - player.height, player.y));

      // Spawn obstacles
      spawnTimerRef.current += dt * 1000;
      const elapsedSteps = Math.floor(elapsedRef.current / 5);
      const currentInterval = Math.max(
        OBSTACLE_MIN_INTERVAL,
        OBSTACLE_INITIAL_INTERVAL - elapsedSteps * OBSTACLE_INTERVAL_DECREMENT,
      );
      if (spawnTimerRef.current >= currentInterval) {
        spawnTimerRef.current -= currentInterval;
        obstaclesRef.current.push(createObstacle(w, elapsedRef.current));
      }

      // Update obstacles
      for (const obs of obstaclesRef.current) {
        obs.y += obs.speed * dt;
      }
      obstaclesRef.current = obstaclesRef.current.filter(
        (obs) => obs.y < h + obs.radius + 10,
      );

      // Collision detection
      let collided = false;
      for (const obs of obstaclesRef.current) {
        if (checkCollision(player, obs)) {
          particlesRef.current = createExplosion(
            player.x + player.width / 2,
            player.y + player.height / 2,
          );
          phaseRef.current = "gameover";
          setGamePhaseRef.current("gameover");
          setDisplayScoreRef.current(scoreRef.current);
          collided = true;
          break;
        }
      }

      // Update particles
      for (const p of particlesRef.current) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 60 * dt;
        p.life += dt / PARTICLE_LIFE;
        p.alpha = Math.max(0, 1 - p.life);
        p.radius = Math.max(0, p.radius * (1 - p.life * 0.5));
      }
      particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);

      // Render
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, gridOffsetRef.current);
      if (!collided) {
        drawPlayer(ctx, player);
        drawObstacles(ctx, obstaclesRef.current);
      }
      drawParticles(ctx, particlesRef.current);
      drawScore(ctx, scoreRef.current, w);

      if (!collided) {
        rafRef.current = requestAnimationFrame((ts) => {
          if (gameLoopRef.current) gameLoopRef.current(ts);
        });
      } else {
        // Drain remaining particle animation
        const drainParticles = (ts: number) => {
          const c = canvasRef.current;
          const cx2 = c?.getContext("2d");
          if (!c || !cx2) return;
          const fw = c.width;
          const fh = c.height;
          const microDt = Math.min(
            (ts - (lastTimeRef.current ?? ts)) / 1000,
            0.05,
          );
          lastTimeRef.current = ts;
          for (const p of particlesRef.current) {
            p.x += p.vx * microDt;
            p.y += p.vy * microDt;
            p.vy += 60 * microDt;
            p.life += microDt / PARTICLE_LIFE;
            p.alpha = Math.max(0, 1 - p.life);
            p.radius = Math.max(0, p.radius * (1 - p.life * 0.5));
          }
          particlesRef.current = particlesRef.current.filter(
            (p) => p.alpha > 0,
          );
          cx2.clearRect(0, 0, fw, fh);
          cx2.fillStyle = "#000000";
          cx2.fillRect(0, 0, fw, fh);
          drawGrid(cx2, fw, fh, gridOffsetRef.current);
          drawParticles(cx2, particlesRef.current);
          drawScore(cx2, scoreRef.current, fw);
          if (particlesRef.current.length > 0) {
            rafRef.current = requestAnimationFrame(drainParticles);
          }
        };
        rafRef.current = requestAnimationFrame(drainParticles);
      }
    };
  });

  // ── Init Game ──────────────────────────────────────────────────────────────

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    const w = canvas ? canvas.width : window.innerWidth;
    const h = canvas ? canvas.height : window.innerHeight;
    playerRef.current = {
      x: w / 2 - PLAYER_SIZE / 2,
      y: h - 100,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      speed: PLAYER_SPEED,
    };
    obstaclesRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    elapsedRef.current = 0;
    lastTimeRef.current = null;
    spawnTimerRef.current = 0;
    gridOffsetRef.current = 0;
    keysRef.current = {
      ArrowLeft: false,
      ArrowRight: false,
      ArrowUp: false,
      ArrowDown: false,
    };
    setDisplayScore(0);
    phaseRef.current = "running";
    setGamePhase("running");
  }, []);

  const startGame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    initGame();
    rafRef.current = requestAnimationFrame((ts) => {
      if (gameLoopRef.current) gameLoopRef.current(ts);
    });
  }, [initGame]);

  // ── Resize canvas ──────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (phaseRef.current === "idle" || phaseRef.current === "gameover") {
        const ctx = canvas.getContext("2d");
        if (ctx) renderStaticBackground(canvas, ctx);
      }
      const p = playerRef.current;
      p.x = Math.max(0, Math.min(canvas.width - p.width, p.x));
      p.y = Math.max(0, Math.min(canvas.height - p.height, p.y));
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Keyboard listeners ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)
      ) {
        e.preventDefault();
      }
      const k = e.key as keyof Keys;
      if (k in keysRef.current) keysRef.current[k] = true;
      if (phaseRef.current === "idle") startGame();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key as keyof Keys;
      if (k in keysRef.current) keysRef.current[k] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [startGame]);

  // ── Touch listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const getPos = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      touchRef.current = getPos(e);
      if (phaseRef.current === "idle") startGame();
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      touchRef.current = getPos(e);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 0) touchRef.current = null;
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [startGame]);

  // Draw static background on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) renderStaticBackground(canvas, ctx);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      <canvas
        ref={canvasRef}
        data-ocid="game.canvas_target"
        tabIndex={0}
        className="absolute inset-0 outline-none"
        style={{ display: "block", cursor: "none" }}
        onKeyDown={(e) => {
          const k = e.key as keyof Keys;
          if (k in keysRef.current) keysRef.current[k] = true;
          if (phaseRef.current === "idle") startGame();
        }}
        onKeyUp={(e) => {
          const k = e.key as keyof Keys;
          if (k in keysRef.current) keysRef.current[k] = false;
        }}
      />

      <div
        data-ocid="game.score_display"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        Score: {displayScore}
      </div>

      {/* IDLE SCREEN */}
      {gamePhase === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="relative mb-8">
            <h1
              className="text-6xl md:text-8xl font-bold font-mono tracking-[0.15em] select-none"
              style={{
                color: "#00ffcc",
                textShadow:
                  "0 0 20px #00ffcc, 0 0 40px #00ffcc, 0 0 80px rgba(0,255,200,0.4)",
              }}
            >
              NEON
            </h1>
            <h1
              className="text-6xl md:text-8xl font-bold font-mono tracking-[0.15em] select-none -mt-3"
              style={{
                color: "#00aaff",
                textShadow:
                  "0 0 20px #00aaff, 0 0 40px #00aaff, 0 0 80px rgba(0,170,255,0.4)",
              }}
            >
              DODGER
            </h1>
          </div>

          <div
            className="w-64 h-px mb-8"
            style={{
              background:
                "linear-gradient(90deg, transparent, #00ffcc, transparent)",
              boxShadow: "0 0 8px #00ffcc",
            }}
          />

          <div className="text-center mb-10 space-y-2">
            <p
              className="text-sm font-mono tracking-widest uppercase"
              style={{ color: "rgba(0,255,200,0.6)" }}
            >
              Arrow Keys or Touch to Move
            </p>
            <p
              className="text-sm font-mono tracking-widest uppercase"
              style={{ color: "rgba(0,255,200,0.4)" }}
            >
              Dodge the Red Circles
            </p>
          </div>

          <button
            type="button"
            data-ocid="game.start_button"
            className="pointer-events-auto relative px-10 py-4 font-mono text-lg tracking-[0.3em] uppercase font-bold transition-all duration-200"
            style={{
              color: "#00ffcc",
              border: "2px solid #00ffcc",
              background: "transparent",
              boxShadow:
                "0 0 16px rgba(0,255,200,0.3), inset 0 0 16px rgba(0,255,200,0.05)",
            }}
            onClick={startGame}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "rgba(0,255,200,0.08)";
              el.style.boxShadow =
                "0 0 32px rgba(0,255,200,0.5), inset 0 0 24px rgba(0,255,200,0.1)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "transparent";
              el.style.boxShadow =
                "0 0 16px rgba(0,255,200,0.3), inset 0 0 16px rgba(0,255,200,0.05)";
            }}
          >
            PRESS ANY KEY TO START
          </button>

          <CornerMarks />
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gamePhase === "gameover" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <h2
            className="text-5xl md:text-7xl font-bold font-mono tracking-[0.1em] mb-4 select-none"
            style={{
              color: "#ff2244",
              textShadow:
                "0 0 20px #ff2244, 0 0 40px #ff2244, 0 0 80px rgba(255,34,68,0.5)",
            }}
          >
            GAME OVER
          </h2>

          <div
            className="w-48 h-px mb-6"
            style={{
              background:
                "linear-gradient(90deg, transparent, #ff2244, transparent)",
              boxShadow: "0 0 8px #ff2244",
            }}
          />

          <p
            className="text-2xl font-mono tracking-[0.25em] mb-10 select-none"
            style={{
              color: "#ffffff",
              textShadow: "0 0 10px rgba(255,255,255,0.5)",
            }}
          >
            SCORE:{" "}
            <span style={{ color: "#00ffcc", textShadow: "0 0 12px #00ffcc" }}>
              {displayScore}
            </span>
          </p>

          <button
            type="button"
            data-ocid="game.play_again_button"
            className="relative px-10 py-4 font-mono text-lg tracking-[0.3em] uppercase font-bold transition-all duration-200"
            style={{
              color: "#00ffcc",
              border: "2px solid #00ffcc",
              background: "transparent",
              boxShadow:
                "0 0 16px rgba(0,255,200,0.3), inset 0 0 16px rgba(0,255,200,0.05)",
            }}
            onClick={startGame}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "rgba(0,255,200,0.08)";
              el.style.boxShadow =
                "0 0 32px rgba(0,255,200,0.5), inset 0 0 24px rgba(0,255,200,0.1)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "transparent";
              el.style.boxShadow =
                "0 0 16px rgba(0,255,200,0.3), inset 0 0 16px rgba(0,255,200,0.05)";
            }}
          >
            PLAY AGAIN
          </button>

          <CornerMarks color="#ff2244" />
        </div>
      )}

      {/* Footer */}
      <div
        className="absolute bottom-4 left-0 right-0 text-center font-mono text-xs pointer-events-none"
        style={{ color: "rgba(0,255,200,0.2)" }}
      >
        © {new Date().getFullYear()} Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          className="pointer-events-auto hover:opacity-80 transition-opacity"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(0,255,200,0.35)" }}
        >
          caffeine.ai
        </a>
      </div>
    </div>
  );
}

// ─── Corner Decoration ────────────────────────────────────────────────────────

function CornerMarks({ color = "#00ffcc" }: { color?: string }) {
  const size = 20;
  const thickness = 2;
  const baseStyle = { opacity: 0.35, boxShadow: `0 0 6px ${color}` };
  return (
    <>
      <div
        className="absolute top-8 left-8 md:top-12 md:left-12"
        style={{
          width: size,
          height: size,
          borderTop: `${thickness}px solid ${color}`,
          borderLeft: `${thickness}px solid ${color}`,
          ...baseStyle,
        }}
      />
      <div
        className="absolute top-8 right-8 md:top-12 md:right-12"
        style={{
          width: size,
          height: size,
          borderTop: `${thickness}px solid ${color}`,
          borderRight: `${thickness}px solid ${color}`,
          ...baseStyle,
        }}
      />
      <div
        className="absolute bottom-12 left-8 md:bottom-16 md:left-12"
        style={{
          width: size,
          height: size,
          borderBottom: `${thickness}px solid ${color}`,
          borderLeft: `${thickness}px solid ${color}`,
          ...baseStyle,
        }}
      />
      <div
        className="absolute bottom-12 right-8 md:bottom-16 md:right-12"
        style={{
          width: size,
          height: size,
          borderBottom: `${thickness}px solid ${color}`,
          borderRight: `${thickness}px solid ${color}`,
          ...baseStyle,
        }}
      />
    </>
  );
}
