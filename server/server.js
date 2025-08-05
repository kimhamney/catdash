const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const WORLD_SIZE = 3000;
const FOOD_COUNT = 200;
const FOOD_SIZE = 10;
const MIN_PLAYER_SIZE = 40;
const ZOOM_FACTOR = 0.15;

const gameState = {
  players: {},
  food: [],
  leaderboard: [],
};

function getRandomColor() {
  const colors = [
    "#FFA6B7",
    "#FFBC80",
    "#FFF176",
    "#A5F2C7",
    "#80D8FF",
    "#B388FF",
    "#FF8A80",
    "#69F0AE",
    "#82B1FF",
    "#F48FB1",
    "#FFD54F",
    "#CE93D8",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function initFood() {
  gameState.food = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    gameState.food.push({
      id: `food-${i}`,
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      size: FOOD_SIZE,
      color: getRandomColor(),
    });
  }
}

function respawnFood() {
  const foodNeeded = FOOD_COUNT - gameState.food.length;
  for (let i = 0; i < foodNeeded; i++) {
    gameState.food.push({
      id: `food-${Date.now()}-${i}`,
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      size: FOOD_SIZE,
      color: getRandomColor(),
    });
  }
}

function updateLeaderboard() {
  const players = Object.values(gameState.players);
  gameState.leaderboard = players
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map((player) => ({
      id: player.id,
      name: player.name,
      score: Math.floor(player.size),
    }));
}

function checkCollision(obj1, obj2) {
  const dx = obj1.x - obj2.x;
  const dy = obj1.y - obj2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (obj1.size + obj2.size) / 2;
}

function checkFoodCollisions(player) {
  const eatenFood = [];
  gameState.food.forEach((food, index) => {
    if (checkCollision(player, food)) {
      eatenFood.push(index);
      player.size += food.size * 0.1;
    }
  });

  eatenFood.reverse().forEach((index) => {
    gameState.food.splice(index, 1);
  });

  return eatenFood.length > 0;
}

function checkPlayerCollisions(player) {
  let collision = false;

  Object.values(gameState.players).forEach((otherPlayer) => {
    if (player.id !== otherPlayer.id) {
      if (checkCollision(player, otherPlayer)) {
        if (player.size > otherPlayer.size * 1.2) {
          player.size += otherPlayer.size * 0.5;

          respawnPlayer(otherPlayer);
          collision = true;
        }
      }
    }
  });

  return collision;
}

function respawnPlayer(player) {
  player.x = Math.random() * WORLD_SIZE;
  player.y = Math.random() * WORLD_SIZE;
  player.size = MIN_PLAYER_SIZE;
  player.velocityX = 0;
  player.velocityY = 0;

  io.to(player.socketId).emit("respawn", {
    x: player.x,
    y: player.y,
    size: player.size,
  });
}

initFood();

function updatePlayerPosition(player, deltaTime) {
  const prevX = player.x;
  const prevY = player.y;

  player.x += player.velocityX * deltaTime * 100;
  player.y += player.velocityY * deltaTime * 100;

  player.x = Math.max(
    player.size / 2,
    Math.min(WORLD_SIZE - player.size / 2, player.x)
  );
  player.y = Math.max(
    player.size / 2,
    Math.min(WORLD_SIZE - player.size / 2, player.y)
  );

  player.velocityX *= 0.98;
  player.velocityY *= 0.98;
}

const TICK_RATE = 50;
let lastTick = Date.now();

setInterval(() => {
  const now = Date.now();
  const deltaTime = (now - lastTick) / 1000;
  lastTick = now;

  Object.values(gameState.players).forEach((player) => {
    updatePlayerPosition(player, deltaTime);

    const ateFoodCount = checkFoodCollisions(player);
    if (ateFoodCount) {
      updateLeaderboard();

      respawnFood();
    }

    const atePlayers = checkPlayerCollisions(player);
    if (atePlayers) {
      updateLeaderboard();
    }
  });

  io.emit("gameState", {
    players: Object.values(gameState.players).map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      size: p.size,
      color: p.color,
      name: p.name,
    })),
    leaderboard: gameState.leaderboard,
  });

  Object.values(gameState.players).forEach((player) => {
    const viewRange = 800 + player.size * 2;

    const visibleFood = gameState.food.filter((food) => {
      const dx = food.x - player.x;
      const dy = food.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < viewRange;
    });

    io.to(player.socketId).emit("visibleFood", visibleFood);

    const zoom = Math.max(0.5, Math.min(1.5, 1 - player.size * ZOOM_FACTOR));
    io.to(player.socketId).emit("cameraUpdate", {
      x: player.x,
      y: player.y,
      zoom: zoom,
    });
  });
}, TICK_RATE);

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on("join", (data) => {
    const playerId = socket.id;
    const player = {
      id: playerId,
      socketId: socket.id,
      name: data.name || `Player ${playerId.substring(0, 5)}`,
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      size: MIN_PLAYER_SIZE,
      color: getRandomColor(),
      velocityX: 0,
      velocityY: 0,
    };

    gameState.players[playerId] = player;

    updateLeaderboard();

    socket.emit("joined", {
      id: playerId,
      x: player.x,
      y: player.y,
      size: player.size,
      color: player.color,
      worldSize: WORLD_SIZE,
    });

    console.log(`Player ${player.name} joined the game`);
  });

  socket.on("move", (data) => {
    const player = gameState.players[socket.id];
    if (player) {
      const speedFactor = Math.max(0.5, 30 / player.size) * 3;

      const vx = isNaN(data.velocityX) ? 0 : data.velocityX;
      const vy = isNaN(data.velocityY) ? 0 : data.velocityY;

      player.velocityX = vx * speedFactor;
      player.velocityY = vy * speedFactor;
    }
  });

  socket.on("changeName", (data) => {
    const player = gameState.players[socket.id];
    if (player && data.name) {
      player.name = data.name;
      updateLeaderboard();
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
      updateLeaderboard();
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
