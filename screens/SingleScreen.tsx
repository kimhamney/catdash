import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, Dimensions, Platform, Text } from "react-native";
import { GameEngine } from "react-native-game-engine";
import * as Matter from "matter-js";

const { width, height } = Dimensions.get("window");

const Cat = (props: any) => {
  const x = props.body.position.x - props.size[0] / 2;
  const y = props.body.position.y - props.size[1] / 2;

  return (
    <View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: props.size[0],
        height: props.size[1],
        borderRadius: props.size[0] / 2,
        backgroundColor: props.color,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "visible",
        transform: props.isCharging
          ? [
              { translateX: Math.random() * 4 - 2 },
              { translateY: Math.random() * 4 - 2 },
            ]
          : [],
      }}
    >
      <View
        style={{
          position: "absolute",
          bottom: -15,
          width: props.size[0],
          alignItems: "center",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            height: 10,
            width: props.size[0] * 0.8,
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: "white",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width:
                props.label === "player"
                  ? (props.size[0] * 0.8 * props.health) / 100
                  : props.size[0] * 0.8,
              backgroundColor: "#00cc00",
              borderRadius: 1,
            }}
          />
        </View>
      </View>
    </View>
  );
};

export default function SingleScreen() {
  const [entities, setEntities] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [gameOver, setGameOver] = useState(false);

  const mouseRef = useRef({ x: width / 2, y: height / 2 });
  const isCharging = useRef(false);
  const isDashing = useRef(false);
  const chargeStart = useRef<number>(0);
  const chargeLevel = useRef<number>(0);
  const directionRef = useRef<{ x: number; y: number }>({ x: 1, y: 0 });
  const engineRef = useRef<Matter.Engine>();
  const containerRef = useRef<HTMLDivElement>(null);
  const shakeInterval = useRef<any>(null);
  const collisionCooldown = useRef<boolean>(false);

  useEffect(() => {
    const setupWorld = () => {
      const engine = Matter.Engine.create({ enableSleeping: false });
      engine.gravity.y = 0;
      engineRef.current = engine;

      const wallThickness = 50;
      const walls = [
        Matter.Bodies.rectangle(
          width / 2,
          height - wallThickness / 2,
          width,
          wallThickness,
          {
            isStatic: true,
            label: "wall-bottom",
            render: { fillStyle: "transparent" },
          }
        ),
        Matter.Bodies.rectangle(
          width / 2,
          wallThickness / 2,
          width,
          wallThickness,
          {
            isStatic: true,
            label: "wall-top",
            render: { fillStyle: "transparent" },
          }
        ),
        Matter.Bodies.rectangle(
          wallThickness / 2,
          height / 2,
          wallThickness,
          height,
          {
            isStatic: true,
            label: "wall-left",
            render: { fillStyle: "transparent" },
          }
        ),
        Matter.Bodies.rectangle(
          width - wallThickness / 2,
          height / 2,
          wallThickness,
          height,
          {
            isStatic: true,
            label: "wall-right",
            render: { fillStyle: "transparent" },
          }
        ),
      ];

      const player = Matter.Bodies.circle(width / 2, height / 2, 25, {
        restitution: 0.5,
        label: "player",
        frictionAir: 0.2,
      });

      const enemies = Array.from({ length: 5 }, (_, i) => {
        const x = Math.random() * (width - 100) + 50;
        const y = Math.random() * (height - 100) + 50;
        return Matter.Bodies.circle(x, y, 25, {
          restitution: 0.9,
          label: `enemy-${i}`,
          frictionAir: 0.01,
        });
      });

      Matter.World.add(engine.world, [player, ...enemies, ...walls]);

      Matter.Events.on(engine, "collisionStart", (event) => {
        const pairs = event.pairs;

        for (let i = 0; i < pairs.length; i++) {
          const pair = pairs[i];

          if (
            (pair.bodyA.label === "player" &&
              pair.bodyB.label.includes("enemy")) ||
            (pair.bodyB.label === "player" &&
              pair.bodyA.label.includes("enemy"))
          ) {
            const playerBody =
              pair.bodyA.label === "player" ? pair.bodyA : pair.bodyB;
            const enemyBody = pair.bodyA.label.includes("enemy")
              ? pair.bodyA
              : pair.bodyB;

            const velX = playerBody.velocity.x - enemyBody.velocity.x;
            const velY = playerBody.velocity.y - enemyBody.velocity.y;
            const impactForce = Math.sqrt(velX * velX + velY * velY);

            if (isDashing.current && !collisionCooldown.current) {
              Matter.Body.applyForce(enemyBody, enemyBody.position, {
                x: velX * 0.02,
                y: velY * 0.02,
              });

              if (impactForce > 30) {
                setScore(
                  (prevScore) => prevScore + Math.floor(impactForce / 10)
                );
              }

              collisionCooldown.current = true;
              setTimeout(() => {
                collisionCooldown.current = false;
              }, 300);
            } else if (impactForce > 15 && !isDashing.current) {
              setHealth((prevHealth) =>
                Math.max(0, prevHealth - Math.floor(impactForce / 5))
              );
            }
          }

          if (
            (pair.bodyA.label.includes("enemy") &&
              pair.bodyB.label.includes("wall")) ||
            (pair.bodyB.label.includes("enemy") &&
              pair.bodyA.label.includes("wall"))
          ) {
            const enemyBody = pair.bodyA.label.includes("enemy")
              ? pair.bodyA
              : pair.bodyB;
            const impactForce = Math.sqrt(
              enemyBody.velocity.x * enemyBody.velocity.x +
                enemyBody.velocity.y * enemyBody.velocity.y
            );

            if (impactForce > 40) {
              const newX = Math.random() * (width - 100) + 50;
              const newY = Math.random() * (height - 100) + 50;
              Matter.Body.setPosition(enemyBody, { x: newX, y: newY });
              Matter.Body.setVelocity(enemyBody, { x: 0, y: 0 });

              setScore((prevScore) => prevScore + 25);
            }
          }
        }
      });

      const runner = Matter.Runner.create();
      Matter.Runner.run(runner, engine);

      const allEntities: any = {
        physics: { engine, world: engine.world },
        player: {
          body: player,
          size: [50, 50],
          color: "pink",
          renderer: Cat,
          originalColor: "pink",
          isCharging: false,
          isDashing: false,
          chargeLevel: 0,
          label: "player",
          directionRef: directionRef,
          health: health,
        },
      };

      enemies.forEach((enemy, i) => {
        allEntities[`enemy-${i}`] = {
          body: enemy,
          size: [50, 50],
          color: `hsl(${Math.random() * 360}, 70%, 70%)`,
          renderer: Cat,
          isCharging: false,
          isDashing: false,
          chargeLevel: 0,
          label: `enemy-${i}`,
        };
      });

      return allEntities;
    };

    const newEntities = setupWorld();
    setEntities(newEntities);

    return () => {
      clearInterval(shakeInterval.current);
      if (engineRef.current) {
        Matter.Events.off(engineRef.current, "collisionStart");
      }
    };
  }, []);

  useEffect(() => {
    if (health <= 0) {
      setGameOver(true);
    }

    if (entities?.player) {
      entities.player.health = health;
    }
  }, [health]);

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleMouseMove = (e: MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        mouseRef.current = { x, y };
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === "Space" && !isCharging.current && entities?.player) {
          isCharging.current = true;
          chargeStart.current = Date.now();

          const ball = entities.player.body;
          if (ball) {
            Matter.Body.setVelocity(ball, { x: 0, y: 0 });

            entities.player.isCharging = true;

            shakeInterval.current = setInterval(() => {
              const chargeTime = (Date.now() - chargeStart.current) / 1000;
              chargeLevel.current = Math.min(1, chargeTime / 2);
              entities.player.chargeLevel = chargeLevel.current;

              const angle = Math.random() * Math.PI * 2;
              const magnitude = 1.5 + chargeLevel.current * 2;
              Matter.Body.applyForce(ball, ball.position, {
                x: Math.cos(angle) * magnitude * 0.001,
                y: Math.sin(angle) * magnitude * 0.001,
              });

              const red = Math.floor(255);
              const green = Math.floor(192 - 150 * chargeLevel.current);
              const blue = Math.floor(203 - 150 * chargeLevel.current);
              entities.player.color = `rgb(${red},${green},${blue})`;
            }, 16);
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space" && isCharging.current && entities?.player) {
          isCharging.current = false;
          isDashing.current = true;

          entities.player.isCharging = false;
          entities.player.isDashing = true;

          clearInterval(shakeInterval.current);

          const ball = entities.player.body;
          const chargeDuration = (Date.now() - chargeStart.current) / 1000;
          const cappedDuration = Math.min(chargeDuration, 2);
          const power = Math.min(3.0, 1.0 + cappedDuration);

          const { x: px, y: py } = ball.position;
          const { x: mx, y: my } = mouseRef.current;
          const dx = mx - px;
          const dy = my - py;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 0) {
            directionRef.current = { x: dx / dist, y: dy / dist };
          }

          const dash = {
            x: directionRef.current.x * power * 60,
            y: directionRef.current.y * power * 60,
          };

          Matter.Body.setVelocity(ball, dash);

          setTimeout(() => {
            if (entities?.player) {
              isDashing.current = false;
              entities.player.isDashing = false;
              entities.player.color = entities.player.originalColor;
            }
          }, 300);
        }
      };

      const enemyAI = setInterval(() => {
        if (!entities) return;

        const player = entities.player?.body;
        if (!player) return;

        Object.keys(entities).forEach((key) => {
          if (key.includes("enemy")) {
            const enemy = entities[key];
            const enemyBody = enemy.body;

            const rand = Math.random();

            if (rand < 0.02) {
              const dx = player.position.x - enemyBody.position.x;
              const dy = player.position.y - enemyBody.position.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist > 0) {
                const direction = { x: dx / dist, y: dy / dist };
                Matter.Body.applyForce(enemyBody, enemyBody.position, {
                  x: direction.x * 0.001,
                  y: direction.y * 0.001,
                });
              }
            } else if (rand < 0.03) {
              const angle = Math.random() * Math.PI * 2;
              const power = Math.random() * 0.02;
              Matter.Body.applyForce(enemyBody, enemyBody.position, {
                x: Math.cos(angle) * power,
                y: Math.sin(angle) * power,
              });

              enemy.isDashing = true;
              setTimeout(() => {
                enemy.isDashing = false;
              }, 300);
            }
          }
        });
      }, 100);

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        clearInterval(enemyAI);
      };
    }
  }, [entities]);

  useEffect(() => {
    if (Platform.OS === "web" && entities) {
      const updateLoop = () => {
        const player = entities?.player?.body;
        if (player && !isCharging.current && !isDashing.current) {
          const { x: tx, y: ty } = mouseRef.current;
          const dx = tx - player.position.x;
          const dy = ty - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 5) {
            const speed = Math.min(5, dist * 0.1);
            directionRef.current = { x: dx / dist, y: dy / dist };

            Matter.Body.setVelocity(player, {
              x: directionRef.current.x * speed,
              y: directionRef.current.y * speed,
            });

            player.frictionAir = 0.2;
          } else {
            Matter.Body.setVelocity(player, { x: 0, y: 0 });
          }
        }

        requestAnimationFrame(updateLoop);
      };

      updateLoop();
    }
  }, [entities]);

  if (!entities) return null;

  return (
    <View style={styles.container} ref={containerRef}>
      <GameEngine style={styles.container} systems={[]} entities={entities} />

      {gameOver && (
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverText}>Game Over!</Text>
          <Text style={styles.finalScoreText}>Final Score: {score}</Text>
          <View
            style={styles.restartButton}
            onClick={() => {
              setScore(0);
              setHealth(100);
              setGameOver(false);

              const newEntities = setupWorld();
              setEntities(newEntities);
            }}
          >
            <Text style={styles.restartText}>Restart</Text>
          </View>
        </View>
      )}
    </View>
  );

  function setupWorld() {
    const engine = Matter.Engine.create({ enableSleeping: false });
    engine.gravity.y = 0;
    engineRef.current = engine;

    const player = Matter.Bodies.circle(width / 2, height / 2, 25, {
      restitution: 0.9,
      label: "player",
      frictionAir: 0.05,
    });

    const enemies = Array.from({ length: 5 }, (_, i) => {
      const x = Math.random() * (width - 100) + 50;
      const y = Math.random() * (height - 100) + 50;
      return Matter.Bodies.circle(x, y, 25, {
        restitution: 0.9,
        label: `enemy-${i}`,
        frictionAir: 0.01,
      });
    });

    const walls = [
      Matter.Bodies.rectangle(width / 2, height + 25, width, 50, {
        isStatic: true,
        label: "wall-bottom",
      }),
      Matter.Bodies.rectangle(width / 2, -25, width, 50, {
        isStatic: true,
        label: "wall-top",
      }),
      Matter.Bodies.rectangle(-25, height / 2, 50, height, {
        isStatic: true,
        label: "wall-left",
      }),
      Matter.Bodies.rectangle(width + 25, height / 2, 50, height, {
        isStatic: true,
        label: "wall-right",
      }),
    ];

    Matter.World.add(engine.world, [player, ...enemies, ...walls]);

    Matter.Events.on(engine, "collisionStart", (event) => {
      const pairs = event.pairs;

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];

        if (
          (pair.bodyA.label === "player" &&
            pair.bodyB.label.includes("enemy")) ||
          (pair.bodyB.label === "player" && pair.bodyA.label.includes("enemy"))
        ) {
          const playerBody =
            pair.bodyA.label === "player" ? pair.bodyA : pair.bodyB;
          const enemyBody = pair.bodyA.label.includes("enemy")
            ? pair.bodyA
            : pair.bodyB;

          const velX = playerBody.velocity.x - enemyBody.velocity.x;
          const velY = playerBody.velocity.y - enemyBody.velocity.y;
          const impactForce = Math.sqrt(velX * velX + velY * velY);

          if (isDashing.current && !collisionCooldown.current) {
            Matter.Body.applyForce(enemyBody, enemyBody.position, {
              x: velX * 0.02,
              y: velY * 0.02,
            });

            if (impactForce > 30) {
              setScore((prevScore) => prevScore + Math.floor(impactForce / 10));
            }

            collisionCooldown.current = true;
            setTimeout(() => {
              collisionCooldown.current = false;
            }, 300);
          } else if (impactForce > 15 && !isDashing.current) {
            setHealth((prevHealth) =>
              Math.max(0, prevHealth - Math.floor(impactForce / 5))
            );
          }
        }

        if (
          (pair.bodyA.label.includes("enemy") &&
            pair.bodyB.label.includes("wall")) ||
          (pair.bodyB.label.includes("enemy") &&
            pair.bodyA.label.includes("wall"))
        ) {
          const enemyBody = pair.bodyA.label.includes("enemy")
            ? pair.bodyA
            : pair.bodyB;
          const impactForce = Math.sqrt(
            enemyBody.velocity.x * enemyBody.velocity.x +
              enemyBody.velocity.y * enemyBody.velocity.y
          );

          if (impactForce > 40) {
            const newX = Math.random() * (width - 100) + 50;
            const newY = Math.random() * (height - 100) + 50;
            Matter.Body.setPosition(enemyBody, { x: newX, y: newY });
            Matter.Body.setVelocity(enemyBody, { x: 0, y: 0 });

            setScore((prevScore) => prevScore + 25);
          }
        }
      }
    });

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    const allEntities: any = {
      physics: { engine, world: engine.world },
      player: {
        body: player,
        size: [50, 50],
        color: "pink",
        renderer: Cat,
        originalColor: "pink",
        isCharging: false,
        isDashing: false,
        chargeLevel: 0,
        label: "player",
        directionRef: directionRef,
        health: health,
      },
    };

    enemies.forEach((enemy, i) => {
      allEntities[`enemy-${i}`] = {
        body: enemy,
        size: [50, 50],
        color: `hsl(${Math.random() * 360}, 70%, 70%)`,
        renderer: Cat,
        isCharging: false,
        isDashing: false,
        chargeLevel: 0,
        label: `enemy-${i}`,
      };
    });

    return allEntities;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef",
  },
  scoreContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  healthText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f44",
  },
  gameOverContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  gameOverText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
  },
  finalScoreText: {
    fontSize: 24,
    color: "#fff",
    marginBottom: 30,
  },
  restartButton: {
    backgroundColor: "#f55",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    cursor: "pointer",
  },
  restartText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
});
