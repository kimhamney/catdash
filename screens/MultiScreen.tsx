import React, { useState, useEffect, useRef } from "react";
import SpriteManager from "./SpriteManager.js";
import PlayerComponent from "./PlayerComponent.js";
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";

const MultiGame = () => {
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [worldSize, setWorldSize] = useState(3000);
  const [players, setPlayers] = useState([]);
  const [food, setFood] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerData, setPlayerData] = useState(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const gameContainerRef = useRef(null);
  const spriteManagerRef = useRef(null);
  const playerComponentRef = useRef(null);

  const [spritesLoaded, setSpritesLoaded] = useState(false);

  useEffect(() => {
    const initializeSprites = async () => {
      try {
        const spriteManager = new SpriteManager();
        await spriteManager.loadSpriteSheet();

        spriteManagerRef.current = spriteManager;
        playerComponentRef.current = new PlayerComponent(spriteManager);
        setSpritesLoaded(true);

        console.log("Sprites loaded successfully");
      } catch (error) {
        console.error("Failed to load sprites:", error);
        setSpritesLoaded(true);
      }
    };

    initializeSprites();
  }, []);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to server");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setConnected(false);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    socket.on("joined", (data) => {
      console.log("Joined game:", data);
      setPlayerId(data.id);
      setWorldSize(data.worldSize);
      setPlayerData({
        id: data.id,
        x: data.x,
        y: data.y,
        size: data.size,
        color: data.color,
      });
      setCamera({
        x: data.x,
        y: data.y,
        zoom: 1,
      });
      setStarted(true);
    });

    socket.on("gameState", (data) => {
      setPlayers(data.players);
      setLeaderboard(data.leaderboard);

      const currentPlayer = data.players.find((p) => p.id === playerId);
      if (currentPlayer) {
        setPlayerData(currentPlayer);
      }
    });

    socket.on("visibleFood", (data) => {
      setFood(data);
    });

    socket.on("cameraUpdate", (data) => {
      setCamera(data);
    });

    socket.on("respawn", (data) => {
      setPlayerData((prevData) => ({
        ...prevData,
        x: data.x,
        y: data.y,
        size: data.size,
      }));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!started) return;

    const handleMouseMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      mousePositionRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || !e.touches[0]) return;

      const rect = canvas.getBoundingClientRect();
      mousePositionRef.current = {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    }

    const updateInterval = setInterval(() => {
      if (!playerData || !camera || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const dx = mousePositionRef.current.x - centerX;
      const dy = mousePositionRef.current.y - centerY;

      const magnitude = Math.sqrt(dx * dx + dy * dy);
      let velocityX = 0;
      let velocityY = 0;

      if (magnitude > 10) {
        velocityX = dx / magnitude;
        velocityY = dy / magnitude;
      }

      if (socketRef.current) {
        socketRef.current.emit("move", { velocityX, velocityY });
      }
    }, 50);

    return () => {
      if (canvas) {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("touchmove", handleTouchMove);
      }
      clearInterval(updateInterval);
    };
  }, [started, playerData, camera]);

  useEffect(() => {
    if (!started || !canvasRef.current || !spritesLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const render = () => {
      if (!ctx || !playerData || !camera) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      food.forEach((item) => {
        const foodX = (item.x - camera.x) * camera.zoom + canvas.width / 2;
        const foodY = (item.y - camera.y) * camera.zoom + canvas.height / 2;
        const foodSize = item.size * camera.zoom;

        ctx.beginPath();
        ctx.fillStyle = item.color;
        ctx.arc(foodX, foodY, foodSize, 0, Math.PI * 2);
        ctx.fill();
      });

      if (playerComponentRef.current) {
        playerComponentRef.current.renderOtherPlayers(
          ctx,
          players,
          camera,
          canvas,
          playerId
        );
      }

      if (playerComponentRef.current) {
        playerComponentRef.current.renderCurrentPlayer(
          ctx,
          playerData,
          camera,
          canvas,
          playerName
        );
      }

      renderLeaderboard(ctx, canvas);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    started,
    spritesLoaded,
    playerData,
    players,
    food,
    leaderboard,
    camera,
    playerId,
    playerName,
  ]);

  const renderLeaderboard = (ctx, canvas) => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(canvas.width - 200, 10, 190, 20 + leaderboard.length * 25);

    ctx.fillStyle = "#fff";
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Leaderboard", canvas.width - 180, 25);

    leaderboard.forEach((leader, index) => {
      ctx.fillText(
        `${index + 1}. ${leader.name}: ${leader.score}`,
        canvas.width - 180,
        50 + index * 25
      );

      if (leader.id === playerId) {
        ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
        ctx.fillRect(canvas.width - 185, 35 + index * 25, 175, 20);
        ctx.fillStyle = "#fff";
      }
    });
  };

  const handleStartGame = () => {
    if (!connected) return;

    socketRef.current.emit("join", {
      name: playerName || "Player",
    });
  };

  const handleNameChange = (e) => {
    setPlayerName(e.target.value);
    if (connected && started && socketRef.current) {
      socketRef.current.emit("changeName", { name: e.target.value });
    }
  };

  const gameContainerStyle = {
    width: "100%",
    height: "100vh",
    overflow: "hidden",
    position: "relative",
  };

  const canvasStyle = {
    display: "block",
    position: "absolute",
    top: 0,
    left: 0,
  };

  const startContainerStyle = {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  };

  const titleStyle = {
    fontSize: "36px",
    fontWeight: "bold",
    marginBottom: "30px",
    color: "#333",
  };

  const inputStyle = {
    width: "250px",
    height: "50px",
    border: "1px solid #ccc",
    borderRadius: "10px",
    fontSize: "18px",
    padding: "0 15px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  };

  const startButtonStyle = {
    backgroundColor: connected ? "#4CAF50" : "#ccc",
    padding: "12px 30px",
    borderRadius: "10px",
    marginTop: "10px",
    cursor: connected ? "pointer" : "default",
    border: "none",
  };

  const startButtonTextStyle = {
    color: "#fff",
    fontSize: "18px",
    fontWeight: "bold",
  };

  const instructionTextStyle = {
    fontSize: "14px",
    textAlign: "center",
    color: "#666",
    marginTop: "30px",
    lineHeight: "24px",
  };

  const nameOverlayStyle = {
    position: "absolute",
    top: "10px",
    right: "220px",
    zIndex: 1,
  };

  const nameInputStyle = {
    width: "150px",
    height: "30px",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: "5px",
    padding: "0 10px",
    fontSize: "14px",
    border: "1px solid #ccc",
  };

  if (!started) {
    return (
      <div style={startContainerStyle}>
        <h1 style={titleStyle}>Agar.io Clone</h1>
        <input
          style={inputStyle}
          placeholder="Enter your name"
          value={playerName}
          onChange={handleNameChange}
          maxLength={15}
        />
        <button
          style={startButtonStyle}
          onClick={handleStartGame}
          disabled={!connected}
        >
          <span style={startButtonTextStyle}>
            {connected ? "Start Game" : "Connecting..."}
          </span>
        </button>
        <p style={instructionTextStyle}>
          Move your cursor to control direction.
          <br />
          Eat food and smaller players to grow.
        </p>
      </div>
    );
  }

  return (
    <div ref={gameContainerRef} style={gameContainerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
      <div style={nameOverlayStyle}>
        <input
          style={nameInputStyle}
          value={playerName}
          onChange={handleNameChange}
          maxLength={15}
          placeholder="Change name"
        />
      </div>
      {!spritesLoaded && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#333",
            fontSize: "18px",
          }}
        >
          Loading sprites...
        </div>
      )}
    </div>
  );
};

export default MultiGame;
