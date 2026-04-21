import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  // Game state
  const gameState = {
    players: {} as Record<string, any>,
    bullets: [] as any[]
  };

  const GAME_WIDTH = 1200;
  const GAME_HEIGHT = 800;

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);
    
    // Create new player
    gameState.players[socket.id] = {
      id: socket.id,
      x: Math.random() * (GAME_WIDTH - 100) + 50,
      y: Math.random() * (GAME_HEIGHT - 100) + 50,
      kills: 0,
      color: `hsl(${Math.random() * 360}, 100%, 60%)`,
    };

    socket.emit("init", gameState);
    socket.broadcast.emit("playerJoin", gameState.players[socket.id]);

    socket.on("move", (dir) => {
      const p = gameState.players[socket.id];
      if (!p) return;
      const speed = 5;
      if (dir.up) p.y = Math.max(20, p.y - speed);
      if (dir.down) p.y = Math.min(GAME_HEIGHT - 20, p.y + speed);
      if (dir.left) p.x = Math.max(20, p.x - speed);
      if (dir.right) p.x = Math.min(GAME_WIDTH - 20, p.x + speed);
    });

    socket.on("shoot", (target) => {
      const p = gameState.players[socket.id];
      if (!p) return;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag === 0) return;
      gameState.bullets.push({
        id: Math.random().toString(),
        ownerId: socket.id,
        x: p.x,
        y: p.y,
        vx: (dx / mag) * 15,
        vy: (dy / mag) * 15,
        life: 100
      });
    });

    socket.on("disconnect", () => {
      delete gameState.players[socket.id];
      io.emit("playerLeave", socket.id);
    });
  });

  // Game Loop
  setInterval(() => {
    // Process bullets
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
      const b = gameState.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life -= 1;

      // collision
      let hit = false;
      for (const targetId in gameState.players) {
        if (targetId !== b.ownerId) {
          const t = gameState.players[targetId];
          const dist = Math.sqrt(Math.pow(t.x - b.x, 2) + Math.pow(t.y - b.y, 2));
          if (dist < 20) {
            // Hit!
            hit = true;
            if (gameState.players[b.ownerId]) {
              gameState.players[b.ownerId].kills += 1;
            }
            // Respawn hit player
            t.x = Math.random() * (GAME_WIDTH - 100) + 50;
            t.y = Math.random() * (GAME_HEIGHT - 100) + 50;
            io.emit("playerHit", { targetId, killerId: b.ownerId });
            break;
          }
        }
      }

      if (hit || b.life <= 0 || b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT) {
        gameState.bullets.splice(i, 1);
      }
    }

    io.emit("state", gameState);
  }, 1000 / 60);

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite DEV Server Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production build...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
