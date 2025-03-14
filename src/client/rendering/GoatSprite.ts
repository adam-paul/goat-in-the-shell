/**
 * GoatSprite.ts - Defines the goat sprite rendering and animations
 * Based on the original GameScene implementation
 */
import Phaser from 'phaser';

export default class GoatSprite {
  private scene: Phaser.Scene;
  private sprite: Phaser.Physics.Arcade.Sprite;
  private lastDirection: 'left' | 'right' | 'idle' = 'right';
  private onGround: boolean = false;
  
  /**
   * Create a goat sprite with animations
   * @param scene The Phaser scene to add the sprite to
   * @param x Initial x position
   * @param y Initial y position
   */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.createTextures();
    
    // Create the sprite
    this.sprite = scene.physics.add.sprite(x, y, 'goat_standing');
    
    // Set up collisions and physics properties
    this.sprite.setBounce(0.1);
    this.sprite.setCollideWorldBounds(false);
    
    // Scale the goat just a bit
    this.sprite.setScale(1.2);
    
    // Adjust the collision body to better match the goat shape
    this.sprite.setSize(28, 26); // Smaller hitbox that matches the visual goat body better
    this.sprite.setOffset(10, 14); // Offset to align with the visible goat body
    
    // Create animations
    this.createAnimations();
  }
  
  /**
   * Create goat textures for standing and running
   */
  private createTextures(): void {
    this.createGoatStandingTexture();
    this.createGoatRunningTexture();
  }
  
  /**
   * Create the standing goat texture
   */
  private createGoatStandingTexture(): void {
    if (this.scene.textures.exists('goat_standing')) {
      return; // Skip if already created
    }
    
    const graphics = this.scene.make.graphics({ x: 0, y: 0 });
    
    // Body
    graphics.fillStyle(0xF0F0F0); // Off-white
    graphics.fillRect(10, 14, 28, 16);
    
    // Head
    graphics.fillStyle(0xF0F0F0);
    graphics.fillRect(32, 6, 10, 12);
    
    // Snout
    graphics.fillStyle(0xE8E8E8);
    graphics.fillRect(42, 9, 6, 6);
    
    // Legs - standing position
    graphics.fillStyle(0xE0E0E0);
    graphics.fillRect(12, 30, 4, 12); // Left front
    graphics.fillRect(22, 30, 4, 12); // Right front
    graphics.fillRect(32, 30, 4, 12); // Left back
    graphics.fillRect(42, 30, 4, 12); // Right back
    
    // Horns
    graphics.fillStyle(0xD8D8D8);
    graphics.fillRect(32, 2, 2, 5); // Left horn
    graphics.fillRect(35, 1, 2, 2);
    graphics.fillRect(38, 0, 2, 2);
    
    graphics.fillRect(39, 2, 2, 5); // Right horn
    graphics.fillRect(42, 1, 2, 2);
    graphics.fillRect(45, 0, 2, 2);
    
    // Eye
    graphics.fillStyle(0x000000);
    graphics.fillRect(38, 9, 3, 3);
    
    // Tail - normal position
    graphics.fillStyle(0xE8E8E8);
    graphics.fillRect(8, 18, 4, 4);
    
    // Back definition
    graphics.lineStyle(1, 0xD0D0D0);
    graphics.lineBetween(10, 14, 38, 14);
    
    // Body shading
    graphics.fillStyle(0xE8E8E8);
    graphics.fillRect(10, 14, 28, 4);
    
    // Generate the texture
    graphics.generateTexture('goat_standing', 50, 42);
    graphics.destroy();
  }
  
  /**
   * Create the running goat texture
   */
  private createGoatRunningTexture(): void {
    if (this.scene.textures.exists('goat_running')) {
      return; // Skip if already created
    }
    
    const graphics = this.scene.make.graphics({ x: 0, y: 0 });
    
    // Body
    graphics.fillStyle(0xF0F0F0); // Off-white
    graphics.fillRect(10, 14, 28, 16);
    
    // Head
    graphics.fillStyle(0xF0F0F0);
    graphics.fillRect(32, 6, 10, 12);
    
    // Snout
    graphics.fillStyle(0xE8E8E8);
    graphics.fillRect(42, 9, 6, 6);
    
    // Legs - running position
    graphics.fillStyle(0xE0E0E0);
    graphics.fillRect(12, 30, 4, 10); // Left front - slightly raised
    graphics.fillRect(22, 33, 4, 9); // Right front - extended
    graphics.fillRect(32, 33, 4, 9); // Left back - extended
    graphics.fillRect(42, 30, 4, 10); // Right back - slightly raised
    
    // Horns
    graphics.fillStyle(0xD8D8D8);
    graphics.fillRect(32, 2, 2, 5); // Left horn
    graphics.fillRect(35, 1, 2, 2);
    graphics.fillRect(38, 0, 2, 2);
    
    graphics.fillRect(39, 2, 2, 5); // Right horn
    graphics.fillRect(42, 1, 2, 2);
    graphics.fillRect(45, 0, 2, 2);
    
    // Eye
    graphics.fillStyle(0x000000);
    graphics.fillRect(38, 9, 3, 3);
    
    // Tail - raised position
    graphics.fillStyle(0xE8E8E8);
    graphics.fillRect(8, 16, 4, 4);
    
    // Back definition
    graphics.lineStyle(1, 0xD0D0D0);
    graphics.lineBetween(10, 14, 38, 14);
    
    // Body shading
    graphics.fillStyle(0xE8E8E8);
    graphics.fillRect(10, 14, 28, 4);
    
    // Generate the texture
    graphics.generateTexture('goat_running', 50, 42);
    graphics.destroy();
  }
  
  /**
   * Create sprite animations
   */
  private createAnimations(): void {
    // Left animation
    if (!this.scene.anims.exists('left')) {
      this.scene.anims.create({
        key: 'left',
        frames: [
          { key: 'goat_standing' },
          { key: 'goat_running' }
        ],
        frameRate: 8,
        repeat: -1
      });
    }
    
    // Turn (idle) animation
    if (!this.scene.anims.exists('turn')) {
      this.scene.anims.create({
        key: 'turn',
        frames: [{ key: 'goat_standing' }],
        frameRate: 10
      });
    }
    
    // Right animation
    if (!this.scene.anims.exists('right')) {
      this.scene.anims.create({
        key: 'right',
        frames: [
          { key: 'goat_standing' },
          { key: 'goat_running' }
        ],
        frameRate: 8,
        repeat: -1
      });
    }
  }
  
  /**
   * Update the sprite based on server state
   */
  update(x: number, y: number, velocityX: number, velocityY: number, onGround: boolean, facingLeft: boolean): void {
    // Update position
    this.sprite.setPosition(x, y);
    
    // Update velocity
    this.sprite.setVelocity(velocityX, velocityY);
    
    // Update ground state
    this.onGround = onGround;
    
    // Update animation based on direction and velocity
    this.updateAnimation(velocityX, facingLeft);
  }
  
  /**
   * Update sprite animation
   */
  private updateAnimation(velocityX: number, facingLeft: boolean): void {
    // Set sprite flip based on facing direction
    this.sprite.setFlipX(facingLeft);
    
    // Determine animation to play
    if (velocityX < -1) {
      this.sprite.anims.play('left', true);
      this.lastDirection = 'left';
    } else if (velocityX > 1) {
      this.sprite.anims.play('right', true);
      this.lastDirection = 'right';
    } else {
      this.sprite.anims.play('turn');
      this.lastDirection = 'idle';
    }
  }
  
  /**
   * Apply tint to the sprite (for death)
   */
  setTint(color: number): void {
    this.sprite.setTint(color);
  }
  
  /**
   * Set sprite alpha (transparency)
   */
  setAlpha(alpha: number): void {
    this.sprite.setAlpha(alpha);
  }
  
  /**
   * Get the sprite object
   */
  getSprite(): Phaser.Physics.Arcade.Sprite {
    return this.sprite;
  }
  
  /**
   * Cleanup the sprite
   */
  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
    }
  }
}