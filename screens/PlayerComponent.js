class PlayerComponent {
  constructor(spriteManager) {
    this.spriteManager = spriteManager;
  }

  renderOtherPlayers(ctx, players, camera, canvas, playerId) {
    players.forEach((player) => {
      if (player.id === playerId) return;

      const playerX = (player.x - camera.x) * camera.zoom + canvas.width / 2;
      const playerY = (player.y - camera.y) * camera.zoom + canvas.height / 2;
      const playerSize = player.size * camera.zoom;

      if (this.isOutOfBounds(playerX, playerY, playerSize, canvas)) {
        return;
      }

      const spriteState = this.spriteManager.getPlayerSpriteState(player);

      const spriteDrawn = this.spriteManager.drawSprite(
        ctx,
        spriteState,
        playerX,
        playerY,
        playerSize
      );

      if (!spriteDrawn) {
        this.drawFallbackPlayer(
          ctx,
          playerX,
          playerY,
          playerSize,
          player.color
        );
      }

      this.drawPlayerName(ctx, player.name, playerX, playerY, playerSize);
    });
  }

  renderCurrentPlayer(ctx, playerData, camera, canvas, playerName) {
    const currentPlayerSize = playerData.size * camera.zoom;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const spriteState = this.spriteManager.getPlayerSpriteState(
      playerData,
      true
    );

    const spriteDrawn = this.spriteManager.drawSprite(
      ctx,
      spriteState,
      centerX,
      centerY,
      currentPlayerSize
    );

    if (!spriteDrawn) {
      this.drawFallbackPlayer(
        ctx,
        centerX,
        centerY,
        currentPlayerSize,
        playerData.color
      );
    }

    // 현재 플레이어 이름 그리기
    // this.drawPlayerName(
    //   ctx,
    //   playerName || "You",
    //   centerX,
    //   centerY,
    //   currentPlayerSize
    // );
  }

  drawFallbackPlayer(ctx, x, y, size, color) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayerName(ctx, name, x, y, size) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.font = `${Math.max(12, size / 3)}px Arial`;
    ctx.textAlign = "center";
    ctx.strokeText(name, x, y);
    ctx.fillText(name, x, y);
  }

  isOutOfBounds(x, y, size, canvas) {
    return (
      x + size < 0 ||
      x - size > canvas.width ||
      y + size < 0 ||
      y - size > canvas.height
    );
  }
}

export default PlayerComponent;
