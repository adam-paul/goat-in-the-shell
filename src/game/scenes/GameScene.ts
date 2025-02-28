import Phaser from 'phaser';

// Define a custom event for game state changes
interface GameStateEvent extends CustomEvent {
  detail: {
    status: 'win' | 'playing' | 'reset' | 'gameover';
  }
}

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private darts!: Phaser.Physics.Arcade.Group;
  private dartTimer!: Phaser.Time.TimerEvent;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private startPoint!: Phaser.GameObjects.Rectangle;
  private endPoint!: Phaser.GameObjects.Rectangle;
  private gameWon: boolean = false;
  private gameOver: boolean = false;
  private worldWidth: number = 2400; // Double the canvas width
  private mainCamera!: Phaser.Cameras.Scene2D.Camera;
  private playerFacingLeft: boolean = false; // Tracks player direction for animations
  private bleatSound!: Phaser.Sound.BaseSound;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    // Create separate textures for standing and running goat
    this.createGoatStandingTexture();
    this.createGoatRunningTexture();
    
    // Create dart texture
    this.createDartTexture();
    
    // Create sounds for the game
    this.createBleatSound();
  }
  
  private createDartTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
    // Draw the dart facing left by default
    graphics.fillStyle(0x303030); // Dark gray for the dart body
    graphics.fillRect(6, 2, 14, 2); // Dart body
    
    // Dart point (triangle)
    graphics.fillStyle(0x505050); // Slightly lighter gray for the point
    graphics.fillTriangle(6, 0, 6, 6, 0, 3);
    
    // Dart feathers
    graphics.fillStyle(0xC0C0C0); // Light gray for the feathers
    graphics.fillRect(17, 0, 3, 6);
    
    // Generate the texture
    graphics.generateTexture('dart', 20, 6);
    graphics.destroy();
  }
  
  private createBleatSound(): void {
    try {
      // Create a programmatic audio data for a goat bleat
      // @ts-ignore - Handle different sound manager implementations
      const audioContext = this.sound.context;
      if (!audioContext) {
        console.warn('Audio context not available for bleat sound');
        return;
      }
      
      // Create an offline context for generating the sound
      const sampleRate = audioContext.sampleRate;
      const offlineCtx = new OfflineAudioContext(1, sampleRate * 0.5, sampleRate);
      
      // Create oscillator for the bleat
      const oscillator = offlineCtx.createOscillator();
      oscillator.type = 'sawtooth';
      
      // Create a gain node for volume control
      const gainNode = offlineCtx.createGain();
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(offlineCtx.destination);
      
      // Set up a simple bleating effect with frequency modulation
      const startTime = 0;
      const duration = 0.3;
      
      // Start with a high pitch and reduce quickly
      oscillator.frequency.setValueAtTime(600, startTime);
      oscillator.frequency.linearRampToValueAtTime(400, startTime + 0.1);
      oscillator.frequency.linearRampToValueAtTime(500, startTime + 0.2);
      oscillator.frequency.linearRampToValueAtTime(300, startTime + duration);
      
      // Control volume envelope
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.setValueAtTime(0.3, startTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      // Start and stop the oscillator
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
      
      // Render the sound
      offlineCtx.startRendering().then((renderedBuffer) => {
        // Create a new sound with the rendered buffer
        const bleatSound = this.sound.add('bleat', { volume: 0.3 });
        this.cache.audio.add('bleat', renderedBuffer);
        this.bleatSound = bleatSound;
      }).catch(err => {
        console.error('Error creating bleat sound:', err);
      });
    } catch (e) {
      console.error('Error setting up bleat sound:', e);
    }
  }
  
  private createGoatStandingTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
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
  
  private createGoatRunningTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
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

  create(): void {
    // Reset game state
    this.gameWon = false;
    this.gameOver = false;
    
    // Notify that game is now in playing state
    this.notifyGameState('playing');
    
    // Set physics world bounds to be twice the width of the canvas
    this.physics.world.setBounds(0, 0, this.worldWidth, 800);
    
    // Create a blue sky background that extends across the whole level
    this.add.rectangle(this.worldWidth / 2, 400, this.worldWidth, 800, 0x87CEEB);
    
    // Setup camera to follow the player
    this.mainCamera = this.cameras.main;
    this.mainCamera.setBounds(0, 0, this.worldWidth, 800);
    
    // Create platforms group
    this.platforms = this.physics.add.staticGroup();
    this.walls = this.physics.add.staticGroup();

    // Generate textures programmatically
    this.createPlatformTexture();
    this.createWallTexture();

    // Create ground that spans the entire level
    const ground = this.platforms.create(this.worldWidth / 2, 768, 'platform') as Phaser.Physics.Arcade.Sprite;
    ground.setScale(this.worldWidth / 50, 1).refreshBody(); // Scale to match world width
    
    // Left section - initial platforms
    // Lower level platforms
    this.platforms.create(200, 650, 'platform');
    this.platforms.create(400, 550, 'platform');
    this.platforms.create(600, 600, 'platform');
    this.platforms.create(800, 500, 'platform');
    
    // Middle level platforms
    this.platforms.create(150, 450, 'platform');
    this.platforms.create(350, 350, 'platform');
    this.platforms.create(550, 400, 'platform');
    this.platforms.create(750, 300, 'platform');
    this.platforms.create(950, 350, 'platform');
    
    // Upper level platforms
    this.platforms.create(300, 200, 'platform');
    this.platforms.create(500, 150, 'platform');
    this.platforms.create(700, 200, 'platform');
    this.platforms.create(900, 150, 'platform');
    this.platforms.create(1100, 200, 'platform');
    
    // Create vertical walls as obstacles in left section
    this.walls.create(400, 700, 'wall');
    this.walls.create(600, 500, 'wall');
    this.walls.create(800, 650, 'wall');
    this.walls.create(300, 350, 'wall');
    this.walls.create(900, 450, 'wall');
    
    // Right section - extending platforms (from 1200 to 2400)
    // Lower level platforms
    this.platforms.create(1300, 650, 'platform');
    this.platforms.create(1500, 550, 'platform');
    this.platforms.create(1700, 600, 'platform');
    this.platforms.create(1900, 500, 'platform');
    this.platforms.create(2100, 550, 'platform');
    
    // Middle level platforms
    this.platforms.create(1350, 450, 'platform');
    this.platforms.create(1550, 350, 'platform');
    this.platforms.create(1750, 400, 'platform');
    this.platforms.create(1950, 300, 'platform');
    this.platforms.create(2150, 400, 'platform');
    
    // Upper level platforms leading to finish
    this.platforms.create(1400, 250, 'platform');
    this.platforms.create(1600, 200, 'platform');
    this.platforms.create(1800, 150, 'platform');
    this.platforms.create(2000, 180, 'platform');
    this.platforms.create(2200, 150, 'platform');
    
    // Create vertical walls as obstacles in right section
    this.walls.create(1400, 600, 'wall');
    this.walls.create(1600, 650, 'wall');
    this.walls.create(1800, 500, 'wall');
    this.walls.create(2000, 400, 'wall');
    this.walls.create(2200, 300, 'wall');

    // Create start point (bottom left)
    this.startPoint = this.add.rectangle(80, 700, 50, 50, 0x00ff00);
    this.physics.add.existing(this.startPoint, true);
    this.add.text(80, 660, 'START', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Create end point (far top right)
    this.endPoint = this.add.rectangle(2320, 120, 50, 50, 0xff0000);
    this.physics.add.existing(this.endPoint, true);
    
    // Add FINISH text above the red box without the background
    this.add.text(2320, 80, 'FINISH', {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Create player (goat) at the start position
    this.player = this.physics.add.sprite(80, 650, 'goat_standing');
    
    // Set up player physics
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(300); // Make sure gravity affects the player
    
    // We now have two separate textures for the goat
    // Create animations using these textures
    this.anims.create({
      key: 'left',
      frames: [
        { key: 'goat_standing' },
        { key: 'goat_running' }
      ],
      frameRate: 8,
      repeat: -1
    });
    
    this.anims.create({
      key: 'turn',
      frames: [{ key: 'goat_standing' }],
      frameRate: 10
    });
    
    this.anims.create({
      key: 'right',
      frames: [
        { key: 'goat_standing' },
        { key: 'goat_running' }
      ],
      frameRate: 8,
      repeat: -1
    });
    
    // Scale the goat just a bit
    this.player.setScale(1.2);
    
    // Adjust the collision body to better match the goat shape - smaller and more precise
    this.player.setSize(28, 26); // Smaller hitbox that matches the visual goat body better
    this.player.setOffset(10, 14); // Offset to align with the visible goat body

    // Create darts group
    this.darts = this.physics.add.group();
    
    // Set up collisions
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.walls);
    
    // Create collision between darts and player (goat) with a smaller hitbox for darts
    this.physics.add.overlap(
      this.player, 
      this.darts, 
      this.hitByDart, 
      (player, dart) => {
        // Create a smaller hitbox for dart collision (~ 60% of the normal hitbox)
        const playerBounds = player.getBounds();
        const dartBounds = dart.getBounds();
        
        // Shrink the player bounds for more precise collision
        const shrinkX = playerBounds.width * 0.2;
        const shrinkY = playerBounds.height * 0.2;
        
        const smallerPlayerBounds = new Phaser.Geom.Rectangle(
          playerBounds.x + shrinkX,
          playerBounds.y + shrinkY,
          playerBounds.width - (shrinkX * 2),
          playerBounds.height - (shrinkY * 2)
        );
        
        // Return true if the dart intersects with the smaller player bounds
        return Phaser.Geom.Rectangle.Overlaps(smallerPlayerBounds, dartBounds);
      }, 
      this
    );
    
    // Start dart shooting timer (every 3 seconds)
    this.dartTimer = this.time.addEvent({
      delay: 3000,
      callback: this.shootDarts,
      callbackScope: this,
      loop: true
    });
    
    // Make camera follow the player
    this.mainCamera.startFollow(this.player, true, 0.1, 0.1);
    
    // Add a transition effect
    this.cameras.main.fadeIn(1000, 0, 0, 0);
    // Create a more reliable collision detection for the end point
    this.physics.add.overlap(
      this.player,
      this.endPoint,
      () => {
        // Only call reachEndPoint if game is not already won
        if (!this.gameWon) {
          this.reachEndPoint();
        }
      },
      undefined,
      this
    );

    // Set up keyboard controls
    this.cursors = this.input.keyboard?.createCursorKeys() || {} as Phaser.Types.Input.Keyboard.CursorKeys;

    // Add direct keyboard handling for space and arrow keys
    // Capture the spacebar to prevent it from scrolling the page
    this.input.keyboard?.addCapture('SPACE');
    
    this.input.keyboard?.on('keydown-SPACE', () => {
      if ((this.player.body.touching.down || this.player.body.blocked.down) && !this.gameWon) {
        this.player.setVelocityY(-470);
      }
    });
    
    this.input.keyboard?.on('keydown-UP', () => {
      if ((this.player.body.touching.down || this.player.body.blocked.down) && !this.gameWon) {
        this.player.setVelocityY(-470);
      }
    });

    // No instruction text at the top anymore
  }

  private createPlatformTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
    // Draw a simple platform texture
    graphics.fillStyle(0x654321); // Brown color
    graphics.fillRect(0, 0, 100, 20);
    graphics.fillStyle(0x8B4513); // Darker brown for top
    graphics.fillRect(0, 0, 100, 5);
    
    // Add some texture details
    graphics.fillStyle(0x5D4037); // Slightly different brown for wood grain
    for (let i: number = 0; i < 5; i++) {
      graphics.fillRect(10 + (i * 20), 8, 5, 10);
    }

    graphics.generateTexture('platform', 100, 20);
    graphics.destroy();
  }
  
  private createWallTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
    // Draw a vertical wall texture
    graphics.fillStyle(0x808080); // Gray color
    graphics.fillRect(0, 0, 20, 100);
    
    // Add texture details (brick pattern)
    graphics.lineStyle(1, 0x606060);
    
    // Horizontal lines
    for (let y: number = 0; y < 100; y += 20) {
      graphics.moveTo(0, y);
      graphics.lineTo(20, y);
    }
    
    // Vertical lines with offset for brick pattern
    for (let x: number = 0; x < 20; x += 10) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, 100);
    }

    graphics.generateTexture('wall', 20, 100);
    graphics.destroy();
  }


  // Shoot darts from the vertical walls
  private shootDarts(): void {
    if (this.gameWon || this.gameOver) return;
    
    // Only shoot darts from walls that are visible on screen
    const visibleWalls = this.walls.getChildren().filter(wall => {
      const wallBounds = wall.getBounds();
      return (
        wallBounds.right > this.cameras.main.scrollX && 
        wallBounds.left < this.cameras.main.scrollX + this.cameras.main.width
      );
    });
    
    // For each visible wall, shoot three darts
    visibleWalls.forEach(wall => {
      const wallBounds = wall.getBounds();
      
      // Vertical spacing for the three darts
      const positions = [
        wallBounds.centerY - 30, // Top dart
        wallBounds.centerY,      // Middle dart
        wallBounds.centerY + 30  // Bottom dart
      ];
      
      // Create three darts per wall
      positions.forEach(yPos => {
        // Shoot dart from the right side of the wall
        const dart = this.darts.create(wallBounds.right, yPos, 'dart');
        
        // Set dart properties
        dart.setVelocityX(-300); // Moving left, faster speed to travel further
        dart.body.allowGravity = false; // Darts don't fall
        
        // Destroy dart after 10 seconds (enough time to go off screen)
        this.time.delayedCall(10000, () => {
          if (dart.active) dart.destroy();
        });
      });
    });
  }
  
  // Handle dart collision with player
  private hitByDart(player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, dart: Phaser.Physics.Arcade.Sprite): void {
    if (this.gameWon || this.gameOver) return;
    
    // Destroy the dart
    dart.destroy();
    
    // Set game over state
    this.gameOver = true;
    
    // Stop player movement and inputs
    player.setVelocity(0, 0);
    player.body.moves = false; // Freeze the goat completely
    
    // Stop the dartTimer
    this.dartTimer.remove();
    
    // Create tranquilized effect - tint the goat blue
    player.setTint(0x0000ff);
    
    // Small camera shake effect
    this.cameras.main.shake(500, 0.02);
    
    // Dispatch game over event
    this.notifyGameState('gameover');
    
    // Show a proper game over modal
    this.showGameOverModal();
  }
  
  // Create a proper game over modal with restart button
  private showGameOverModal(): void {
    // Get camera center position for modal positioning
    const modalX = this.cameras.main.midPoint.x;
    const modalY = this.cameras.main.midPoint.y;
    
    // 1. Add overlay
    const overlay = this.add.rectangle(
      modalX, 
      modalY, 
      this.cameras.main.width, 
      this.cameras.main.height, 
      0x000000, 
      0.7
    );
    
    // 2. Create modal background
    const modalBg = this.add.rectangle(
      modalX,
      modalY,
      400,
      250,
      0x333333,
      0.9
    );
    
    // 3. Add border
    const modalBorder = this.add.rectangle(
      modalX,
      modalY,
      400,
      250,
      0xffffff,
      0
    );
    modalBorder.setStrokeStyle(3, 0xffffff, 1);
    
    // 4. Create syringe icon
    this.createSyringeIcon(modalX, modalY - 70);
    
    // 5. Display tranquilized message
    const gameOverText = this.add.text(modalX, modalY - 20, 'TRANQUILIZED!', {
      fontSize: '32px',
      color: '#ff0000',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // 6. Add explanatory text
    const explanationText = this.add.text(modalX, modalY + 20, 'Your goat was hit by a dart!', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);
    
    // 7. Add restart button
    const buttonBg = this.add.rectangle(
      modalX,
      modalY + 70,
      150,
      40,
      0x4CAF50 // Green button
    ).setInteractive();
    
    const buttonText = this.add.text(modalX, modalY + 70, 'RESTART', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Button hover effect
    buttonBg.on('pointerover', () => {
      buttonBg.setFillStyle(0x66BB6A); // Lighter green
      this.input.setDefaultCursor('pointer');
    });
    
    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(0x4CAF50); // Back to normal green
      this.input.setDefaultCursor('default');
    });
    
    // Button click - restart the game
    buttonBg.on('pointerdown', () => {
      // Reset cursor
      this.input.setDefaultCursor('default');
      
      // Notify reset state
      this.notifyGameState('reset');
      
      // Restart the scene
      this.scene.restart();
    });
    
    // Start with low alpha and fade in
    overlay.setAlpha(0);
    modalBg.setAlpha(0);
    modalBorder.setAlpha(0);
    gameOverText.setAlpha(0);
    explanationText.setAlpha(0);
    buttonBg.setAlpha(0);
    buttonText.setAlpha(0);
    
    // Fade in all elements
    this.tweens.add({
      targets: [overlay, modalBg, modalBorder, gameOverText, explanationText, buttonBg, buttonText],
      alpha: 1,
      duration: 400,
      ease: 'Power2',
      delay: function(i: number) { return 100 * i; }
    });
  }
  
  // Create a simple syringe icon for the game over modal
  private createSyringeIcon(x: number, y: number): void {
    // Create syringe body
    const syringeBody = this.add.rectangle(x, y, 50, 12, 0xf0f0f0);
    
    // Create syringe plunger
    const plunger = this.add.rectangle(x + 20, y, 10, 20, 0xd0d0d0);
    
    // Create needle
    const needle = this.add.rectangle(x - 30, y, 20, 3, 0xc0c0c0);
    
    // Create liquid in syringe
    const liquid = this.add.rectangle(x - 10, y, 30, 8, 0x0000ff); // Blue tranquilizer
    
    // Animate the syringe with a slight pulse
    this.tweens.add({
      targets: [syringeBody, plunger, needle, liquid],
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  update(): void {
    if (this.gameWon || this.gameOver) return;

    // Handle player movement
    if (this.cursors.left?.isDown) {
      this.player.setVelocityX(-200); // Slightly faster for better gameplay
      this.player.anims.play('left', true);
      this.playerFacingLeft = true; // Track that player is facing left
    } else if (this.cursors.right?.isDown) {
      this.player.setVelocityX(200); // Slightly faster for better gameplay
      this.player.anims.play('right', true);
      this.playerFacingLeft = false; // Track that player is facing right
    } else {
      this.player.setVelocityX(0);
      this.player.anims.play('turn');
    }

    // Update the sprite flip based on player direction
    this.player.setFlipX(this.playerFacingLeft);

    // Jump when spacebar or up is pressed and player is on the ground
    if ((this.cursors.space?.isDown || this.cursors.up?.isDown) && 
        (this.player.body.touching.down || this.player.body.blocked.down)) {
      this.player.setVelocityY(-500); // Slightly higher jump for the larger level
      
      // Play the bleat sound if it exists
      if (this.bleatSound && this.sound.locked === false) {
        // Add a small random pitch variation each time
        const randomPitch = 0.9 + Math.random() * 0.2; // Between 0.9 and 1.1
        try {
          // @ts-ignore - Some sound implementations may not have setRate
          this.bleatSound.setRate(randomPitch);
        } catch (e) {
          // Ignore if setRate is not available
        }
        this.bleatSound.play();
      }
    }
  }

  private reachEndPoint(): void {
    // Set game state to won and stop player movement
    this.gameWon = true;
    this.player.setVelocity(0, 0);
    
    // Clear all darts
    this.darts.clear(true, true);
    
    // Stop dart timer
    this.dartTimer.remove();
    
    // Stop camera following
    this.cameras.main.stopFollow();
    
    // Get camera center position for modal positioning
    const modalX = this.cameras.main.midPoint.x;
    const modalY = this.cameras.main.midPoint.y;
    
    // Create a simple win modal
    
    // 1. Add overlay
    const overlay = this.add.rectangle(
      modalX, 
      modalY, 
      this.cameras.main.width, 
      this.cameras.main.height, 
      0x000000, 
      0.5
    );
    
    // 2. Create blue modal background
    const modalBg = this.add.rectangle(
      modalX,
      modalY,
      500,
      300,
      0x3498db,
      0.9
    );
    
    // 3. Add white border
    const modalBorder = this.add.rectangle(
      modalX,
      modalY,
      500,
      300,
      0xffffff,
      0
    );
    modalBorder.setStrokeStyle(4, 0xffffff, 1);
    
    // 4. Create simple trophy icon
    const trophy = this.add.rectangle(
      modalX,
      modalY - 75,
      40,
      60,
      0xffd700
    );
    
    // 5. Display win message
    const winText = this.add.text(modalX, modalY - 15, 'YOU WIN!', {
      fontSize: '64px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // 6. Add congratulatory text
    const congratsText = this.add.text(modalX, modalY + 70, 'Congratulations!\nYou completed the challenge!', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center'
    }).setOrigin(0.5);
    
    // Add simple animations to make the modal more attractive
    
    // Pulse the win text
    this.tweens.add({
      targets: winText,
      scale: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Pulse the trophy
    this.tweens.add({
      targets: trophy,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut' 
    });
    
    // Add a simple particle effect for celebration
    const particles = this.add.particles(modalX, modalY - 150, 'goat_standing', {
      speed: 100,
      scale: { start: 0.1, end: 0 },
      blendMode: 'ADD',
      lifespan: 1000,
      gravityY: 200
    });
    
    // Explode particles
    particles.explode(50, 0, 0);
    
    // Add delayed particles for continued celebration
    this.time.delayedCall(500, () => {
      particles.explode(30, -100, 0);
    });
    
    this.time.delayedCall(1000, () => {
      particles.explode(30, 100, 0);
    });
    
    // Start with low alpha and fade in
    overlay.setAlpha(0);
    modalBg.setAlpha(0);
    modalBorder.setAlpha(0);
    trophy.setAlpha(0);
    winText.setAlpha(0);
    congratsText.setAlpha(0);
    
    // Fade in all elements
    this.tweens.add({
      targets: [overlay, modalBg, modalBorder, trophy, winText, congratsText],
      alpha: 1,
      duration: 500,
      ease: 'Power2',
      delay: function(i: number) { return 100 * i; }
    });
    
    // Notify the React component that the game is won
    this.notifyGameState('win');
  }
  
  // Utility method to communicate with the React component
  private notifyGameState(status: 'win' | 'playing' | 'reset' | 'gameover'): void {
    // Create and dispatch a custom event to notify the React app of game state changes
    const event = new CustomEvent('game-state-update', {
      detail: { status }
    }) as GameStateEvent;
    window.dispatchEvent(event);
  }
}