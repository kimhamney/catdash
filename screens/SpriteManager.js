import { Image, Platform } from "react-native";

class SpriteManager {
  constructor() {
    this.spriteSheet = null;
    this.spriteWidth = 0;
    this.spriteHeight = 0;
    this.cols = 2;
    this.rows = 2;
    this.loaded = false;

    this.sprites = {
      idle: { x: 0, y: 0 },
      left: { x: 1, y: 0 },
      right: { x: 0, y: 1 },
      hit: { x: 1, y: 1 },
    };
  }

  async loadSpriteSheet() {
    return new Promise((resolve, reject) => {
      let spriteUri = "";

      if (Platform.OS === "web") {
        spriteUri = "/images/cat_sprite.png";
        const img = new window.Image();
        img.onload = () => {
          this.spriteSheet = img;
          this.spriteWidth = img.width / this.cols;
          this.spriteHeight = img.height / this.rows;
          this.loaded = true;
          resolve(true);
        };
        img.onerror = (e) => {
          console.error("Failed to load sprite:", e);
          reject(e);
        };
        img.src = spriteUri;
      } else {
        const resolvedAsset = Image.resolveAssetSource(
          "/images/cat_sprite.png"
        );
        spriteUri = resolvedAsset.uri;

        Image.getSize(
          spriteUri,
          (width, height) => {
            this.spriteSheet = { uri: spriteUri };
            this.spriteWidth = width / this.cols;
            this.spriteHeight = height / this.rows;
            this.loaded = true;
            resolve(true);
          },
          (error) => {
            console.error("Failed to load sprite size:", error);
            reject(error);
          }
        );
      }
    });
  }

  getPlayerSpriteState(player, isCurrentPlayer = false) {
    // 플레이어가 커지고 있는 경우 (먹이를 먹었을 때)
    // if (player.isGrowing) {
    //   return "happy";
    // }

    // 현재 플레이어가 다른 플레이어와 충돌 위험이 있는 경우
    // if (player.isDangerous) {
    //   return "angry";
    // }

    return "idle";
  }

  drawSprite(ctx, spriteState, x, y, size) {
    if (!this.loaded || !this.spriteSheet) return false;

    const sprite = this.sprites[spriteState] || this.sprites.idle;
    const sourceX = sprite.x * this.spriteWidth;
    const sourceY = sprite.y * this.spriteHeight;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(
      this.spriteSheet,
      sourceX,
      sourceY,
      this.spriteWidth,
      this.spriteHeight,
      x - size,
      y - size,
      size * 2,
      size * 2
    );

    ctx.restore();
    return true;
  }
}

export default SpriteManager;
