import Phaser from 'phaser';

// Define a custom event for game state changes
interface GameStateEvent extends CustomEvent {
  detail: {
    status: 'win' | 'playing' | 'reset' | 'gameover' | 'select' | 'placement';
    deathType?: 'dart' | 'spike';
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
  
  // New properties for round-based gameplay
  private currentRound: number = 1;
  private placedItems: Array<{type: string, x: number, y: number, gameObject: Phaser.GameObjects.GameObject}> = [];
  private itemPlacementMode: boolean = false;
  private itemToPlace: string = '';
  private itemPreview?: Phaser.GameObjects.Rectangle;
  private roundText!: Phaser.GameObjects.Text;
  private gameStarted: boolean = false; // Track if the game has started
  private countdownText?: Phaser.GameObjects.Text; // For countdown display
  private modalElements: Phaser.GameObjects.GameObject[] = []; // Store modal elements for cleanup

  constructor() {
    super('GameScene');
  }

  preload(): void {
    // Create separate textures for standing and running goat
    this.createGoatStandingTexture();
    this.createGoatRunningTexture();
    
    // Create dart texture
    this.createDartTexture();
    
    // Create spike texture
    this.createSpikeTexture();
    
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
  
  private createSpikeTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
    // Create a texture that looks like a platform but with a slightly different color
    // to indicate danger (subtle red tint)
    graphics.fillStyle(0x8B4513); // Base brown color
    graphics.fillRect(0, 0, 100, 20);
    graphics.fillStyle(0x954321); // Slightly reddish brown for top
    graphics.fillRect(0, 0, 100, 5);
    
    // Add some texture details with a reddish tint
    graphics.fillStyle(0x7D3027); // Reddish brown for wood grain
    for (let i: number = 0; i < 5; i++) {
      graphics.fillRect(10 + (i * 20), 8, 5, 10);
    }

    graphics.generateTexture('dangerous_platform', 100, 20);
    graphics.destroy();
  }
  
  private createBleatSound(): void {
    try {
      // Create a programmatic audio data for a goat bleat
      // @ts-expect-error - Handle different sound manager implementations
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
      }).catch(error => {
        console.warn('Could not create bleat sound:', error);
      });
    } catch (error) {
      console.warn('Could not create bleat sound:', error);
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
    this.gameStarted = false; // Game hasn't started yet
    
    console.log('GameScene created - initializing game elements');
    
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

    // Create start point (bottom left) - just a position marker, no visible rectangle
    const startX = 80;
    const startY = 700;
    this.startPoint = this.add.rectangle(startX, startY, 1, 1, 0x000000, 0); // Completely invisible
    this.physics.add.existing(this.startPoint, true);
    
    // Add START text above the start position
    this.add.text(startX, startY - 40, 'START', {
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
        // Type assertion to ensure we have the correct types
        const playerSprite = player as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
        const dartSprite = dart as Phaser.Physics.Arcade.Sprite;
        
        // Create a smaller hitbox for dart collision (~ 60% of the normal hitbox)
        const playerBounds = playerSprite.getBounds();
        const dartBounds = dartSprite.getBounds();
        
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
    console.log('Initial dart timer created');
    
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

    // Add round counter text
    this.roundText = this.add.text(16, 16, `Round: ${this.currentRound}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.roundText.setScrollFactor(0); // Fix to camera
    
    console.log('Setting up event listeners for item placement');
    
    // Listen for item placement events from React
    window.addEventListener('place-item', ((_e: Event) => {
      console.log('place-item event received');
      this.handlePlaceItem(_e as CustomEvent);
    }) as EventListener);
    
    window.addEventListener('enter-placement-mode', ((_e: Event) => {
      console.log('enter-placement-mode event received');
      this.enterPlacementMode(_e as CustomEvent);
    }) as EventListener);
    
    window.addEventListener('exit-placement-mode', ((_e: Event) => {
      console.log('exit-placement-mode event received');
      this.exitPlacementMode();
    }) as EventListener);
    
    // Listen for continue to next round event
    window.addEventListener('continue-to-next-round', ((_e: Event) => {
      console.log('continue-to-next-round event received');
      this.startNextRound();
    }) as EventListener);
    
    // Pause physics until the game starts
    this.physics.pause();
    
    // Start with select state instead of playing
    console.log('Notifying initial game state: select');
    this.notifyGameState('select');
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
    if (this.gameWon || this.gameOver || !this.gameStarted) {
      console.log('Not shooting darts - game state prevents it', {
        gameWon: this.gameWon,
        gameOver: this.gameOver,
        gameStarted: this.gameStarted
      });
      return; // Don't shoot darts if game hasn't started
    }
    
    // Only shoot darts from walls that are visible on screen
    const visibleWalls = this.walls.getChildren().filter(wall => {
      // Type assertion to ensure wall has getBounds method
      const wallSprite = wall as Phaser.GameObjects.Sprite;
      const wallBounds = wallSprite.getBounds();
      return (
        wallBounds.right > this.cameras.main.scrollX && 
        wallBounds.left < this.cameras.main.scrollX + this.cameras.main.width
      );
    });
    
    console.log(`Shooting darts from ${visibleWalls.length} visible walls`);
    
    // For each visible wall, shoot three darts
    visibleWalls.forEach(wall => {
      // Type assertion to ensure wall has getBounds method
      const wallSprite = wall as Phaser.GameObjects.Sprite;
      const wallBounds = wallSprite.getBounds();
      
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
  private hitByDart(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
    dart: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile
  ): void {
    if (this.gameWon || this.gameOver) return;
    
    // Type assertion to ensure we have the correct types
    const playerSprite = player as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    const dartSprite = dart as Phaser.Physics.Arcade.Sprite;
    
    // Destroy the dart
    dartSprite.destroy();
    
    // Set game over state
    this.gameOver = true;
    
    // Stop player movement and inputs
    playerSprite.setVelocity(0, 0);
    playerSprite.body.moves = false; // Freeze the goat completely
    
    // Stop the dartTimer
    this.dartTimer.remove();
    
    // Create tranquilized effect - tint the goat blue
    playerSprite.setTint(0x0000ff);
    
    // Small camera shake effect
    this.cameras.main.shake(500, 0.02);
    
    // Dispatch game over event with death type
    this.notifyGameState('gameover', 'dart');
    
    // No longer show the in-game modal, let React handle it
  }
  
  update(): void {
    if (this.gameWon || this.gameOver) return;
    
    // Handle item placement preview movement
    if (this.itemPlacementMode && this.itemPreview) {
      const pointer = this.input.activePointer;
      if (!pointer) return; // Guard against null pointer
      
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.itemPreview.setPosition(worldPoint.x, worldPoint.y);
      
      // Handle click to place
      if (pointer.isDown && pointer.getDuration() > 200) { // Add a small delay to prevent accidental clicks
        console.log(`Confirming placement at (${worldPoint.x}, ${worldPoint.y})`);
        const event = new CustomEvent('confirm-placement', {
          detail: { 
            type: this.itemToPlace,
            x: worldPoint.x,
            y: worldPoint.y
          }
        });
        window.dispatchEvent(event);
        
        // Prevent multiple clicks
        this.input.activePointer.reset();
      }
      
      return; // Skip regular update when in placement mode
    }
    
    // Don't process player movement if game hasn't started
    if (!this.gameStarted) return;

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
          // @ts-expect-error - Some sound implementations may not have setRate
          this.bleatSound.setRate(randomPitch);
        } catch (error) {
          // Ignore if setRate is not available
          console.debug('Sound setRate not available:', error);
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
  
  // New methods for round-based gameplay
  private handlePlaceItem(event: CustomEvent): void {
    const { type, x, y } = event.detail;
    console.log(`Handling item placement: ${type} at (${x}, ${y})`);
    this.placeItem(type, x, y);
    this.exitPlacementMode();
    this.startRound();
  }
  
  private enterPlacementMode(event: CustomEvent): void {
    const { type } = event.detail;
    console.log(`Entering placement mode for item type: ${type}`);
    this.itemPlacementMode = true;
    this.itemToPlace = type;
    
    // Create a preview of the item
    this.time.delayedCall(100, () => {
      this.createItemPreview();
    });
    
    // Only pause physics if they're not already paused and the system exists
    if (this.physics && this.physics.world && !this.physics.world.isPaused) {
      this.physics.pause();
    }
    
    // Notify that we're in placement mode
    this.notifyGameState('placement');
  }
  
  private exitPlacementMode(): void {
    console.log('Exiting placement mode');
    this.itemPlacementMode = false;
    
    // Remove the preview
    if (this.itemPreview) {
      this.itemPreview.destroy();
      this.itemPreview = undefined;
    }
  }
  
  private createItemPreview(): void {
    // Create a preview based on the item type
    if (this.itemPreview) {
      this.itemPreview.destroy();
    }
    
    const pointer = this.input.activePointer;
    if (!pointer) {
      console.log('No active pointer found');
      return;
    }
    
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    
    console.log(`Creating item preview for ${this.itemToPlace} at (${worldPoint.x}, ${worldPoint.y})`);
    
    switch (this.itemToPlace) {
      case 'platform': {
        this.itemPreview = this.add.rectangle(worldPoint.x, worldPoint.y, 200, 20, 0x00ff00, 0.5);
        break;
      }
      case 'spike': {
        this.itemPreview = this.add.rectangle(worldPoint.x, worldPoint.y, 50, 20, 0xff0000, 0.5);
        break;
      }
      case 'moving': {
        this.itemPreview = this.add.rectangle(worldPoint.x, worldPoint.y, 100, 20, 0x0000ff, 0.5);
        break;
      }
      case 'shield': {
        this.itemPreview = this.add.rectangle(worldPoint.x, worldPoint.y, 40, 40, 0xFF9800, 0.5);
        break;
      }
      default: {
        this.itemPreview = this.add.rectangle(worldPoint.x, worldPoint.y, 50, 50, 0xffff00, 0.5);
      }
    }
  }
  
  private placeItem(type: string, x: number, y: number): void {
    console.log(`Placing item: ${type} at (${x}, ${y})`);
    let gameObject: Phaser.GameObjects.GameObject;
    
    try {
      switch (type) {
        case 'platform': {
          // Create a platform at the specified position
          gameObject = this.platforms.create(x, y, 'platform');
          (gameObject as Phaser.Physics.Arcade.Sprite).setScale(1).refreshBody();
          console.log('Platform created');
          break;
        }
        case 'spike': {
          // Create a dangerous platform that looks similar to regular platforms
          try {
            const dangerousPlatform = this.physics.add.sprite(x, y, 'dangerous_platform');
            dangerousPlatform.setImmovable(true);
            dangerousPlatform.body.allowGravity = false;
            
            // Add collision with player that causes game over with "Busted goat ankles" message
            this.physics.add.collider(this.player, dangerousPlatform, this.hitDangerousPlatform, undefined, this);
            gameObject = dangerousPlatform;
            console.log('Dangerous platform created');
          } catch (error) {
            console.error('Error creating spike:', error);
            // Fallback to a simple rectangle if sprite creation fails
            gameObject = this.add.rectangle(x, y, 100, 20, 0xff0000);
            this.physics.add.existing(gameObject, true);
            this.physics.add.collider(this.player, gameObject, this.hitDangerousPlatform, undefined, this);
            console.log('Fallback dangerous platform created');
          }
          break;
        }
        case 'moving': {
          // Create a moving platform that stays at the same height
          try {
            const movingPlatform = this.physics.add.sprite(x, y, 'platform');
            movingPlatform.setImmovable(true);
            movingPlatform.body.allowGravity = false;
            
            // Add collision with player
            this.physics.add.collider(this.player, movingPlatform);
            
            // Add movement tween - only move back and forth a bit (100px each direction)
            this.tweens.add({
              targets: movingPlatform,
              x: x + 100, // Move 100px to the right
              duration: 2000,
              yoyo: true,
              repeat: -1,
              ease: 'Linear'
            });
            gameObject = movingPlatform;
            console.log('Moving platform created');
          } catch (error) {
            console.error('Error creating moving platform:', error);
            // Fallback to a simple rectangle if sprite creation fails
            gameObject = this.add.rectangle(x, y, 100, 20, 0x0000ff);
            this.physics.add.existing(gameObject, true);
            this.physics.add.collider(this.player, gameObject);
            console.log('Fallback moving platform created');
          }
          break;
        }
        case 'shield': {
          // Create a shield block that can block darts
          try {
            // Create a small orange block
            const shieldBlock = this.physics.add.sprite(x, y, 'platform');
            shieldBlock.setDisplaySize(40, 40); // Make it square and small
            shieldBlock.setTint(0xFF9800); // Orange color
            shieldBlock.setImmovable(true);
            shieldBlock.body.allowGravity = false;
            
            // Add collision with player
            this.physics.add.collider(this.player, shieldBlock);
            
            // Add collision with darts - destroy darts when they hit the shield
            this.physics.add.overlap(shieldBlock, this.darts, (shield, dart) => {
              // Type assertion to ensure we have the correct types
              const dartSprite = dart as Phaser.Physics.Arcade.Sprite;
              
              // Create a small particle effect to show the dart being blocked
              this.createDartBlockEffect(dartSprite.x, dartSprite.y);
              
              // Destroy the dart
              dartSprite.destroy();
              
              console.log('Dart blocked by shield!');
            }, undefined, this);
            
            gameObject = shieldBlock;
            console.log('Shield block created');
          } catch (error) {
            console.error('Error creating shield block:', error);
            // Fallback to a simple rectangle if sprite creation fails
            gameObject = this.add.rectangle(x, y, 40, 40, 0xFF9800);
            this.physics.add.existing(gameObject, true);
            this.physics.add.collider(this.player, gameObject);
            
            // Add collision with darts for the fallback shield
            this.physics.add.overlap(gameObject, this.darts, (shield, dart) => {
              const dartSprite = dart as Phaser.Physics.Arcade.Sprite;
              this.createDartBlockEffect(dartSprite.x, dartSprite.y);
              dartSprite.destroy();
            }, undefined, this);
            
            console.log('Fallback shield block created');
          }
          break;
        }
        default: {
          gameObject = this.add.rectangle(x, y, 50, 50, 0xffff00);
          console.log('Default item created');
        }
      }
      
      // Store the placed item
      this.placedItems.push({ type, x, y, gameObject });
      console.log(`Total placed items: ${this.placedItems.length}`);
    } catch (error) {
      console.error('Error in placeItem:', error);
      // Create a fallback item if there was an error
      try {
        gameObject = this.add.rectangle(x, y, 100, 20, 0xff00ff);
        this.physics.add.existing(gameObject, true);
        this.physics.add.collider(this.player, gameObject);
        this.placedItems.push({ type, x, y, gameObject });
        console.log('Created fallback item due to error');
      } catch (fallbackError) {
        console.error('Failed to create fallback item:', fallbackError);
      }
    }
  }
  
  private startRound(): void {
    console.log(`Starting round ${this.currentRound}`);
    // Reset player position
    this.player.setPosition(this.startPoint.x, this.startPoint.y);
    this.player.setVelocity(0, 0);
    
    // Update round text
    this.roundText.setText(`Round: ${this.currentRound}`);
    
    // Make sure any existing countdown text is removed
    if (this.countdownText) {
      this.countdownText.destroy();
      this.countdownText = undefined;
    }
    
    // Create countdown text in the center of the screen
    this.countdownText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      '3',
      {
        fontSize: '64px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6
      }
    ).setOrigin(0.5).setScrollFactor(0);
    
    // Start countdown
    let countdown = 3;
    
    // Create a timer event that fires every second
    const countdownTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          // Update countdown text
          if (this.countdownText) {
            this.countdownText.setText(countdown.toString());
          }
        } else {
          // Countdown finished, start the game
          if (this.countdownText) {
            this.countdownText.destroy();
            this.countdownText = undefined;
          }
          
          // Resume physics to start the game
          this.physics.resume();
          this.gameStarted = true;
          
          // Ensure dart timer is active
          if (this.dartTimer) {
            this.dartTimer.remove();
          }
          
          // Create a new dart timer
          this.dartTimer = this.time.addEvent({
            delay: 3000,
            callback: this.shootDarts,
            callbackScope: this,
            loop: true
          });
          console.log('Dart timer started for this round');
          
          // Notify that the game is in playing state
          this.notifyGameState('playing');
          
          // Stop the timer
          countdownTimer.remove();
        }
      },
      callbackScope: this,
      repeat: 2
    });
  }
  
  private startNextRound(): void {
    // Clean up any modal elements from previous round
    this.cleanupModalElements();
    
    this.currentRound++;
    console.log(`Starting next round: ${this.currentRound}`);
    
    // Reset game state but keep placed items
    this.gameOver = false;
    this.gameStarted = false; // Game is paused until next item is placed
    
    // Reset player appearance
    if (this.player && this.player.active) {
      this.player.clearTint();
      this.player.setVelocity(0, 0);
      this.player.setPosition(this.startPoint.x, this.startPoint.y);
      this.player.body.moves = true; // Re-enable movement
    } else {
      // If player is not valid, recreate it
      this.recreatePlayer();
    }
    
    // Restart the dart timer
    if (this.dartTimer) {
      this.dartTimer.remove();
    }
    this.dartTimer = this.time.addEvent({
      delay: 3000,
      callback: this.shootDarts,
      callbackScope: this,
      loop: true
    });
    console.log('Dart timer restarted for new round');
    
    // Pause physics until next item is placed
    this.physics.pause();
    
    // Notify that we need to select a new item
    this.notifyGameState('select');
  }
  
  // Helper method to clean up modal elements
  private cleanupModalElements(): void {
    console.log(`Cleaning up ${this.modalElements.length} modal elements`);
    this.modalElements.forEach(element => {
      if (element && element.active) {
        element.destroy();
      }
    });
    this.modalElements = [];
  }
  
  // Helper method to recreate player if needed
  private recreatePlayer(): void {
    console.log('Recreating player');
    // Create player (goat) at the start position
    this.player = this.physics.add.sprite(this.startPoint.x, this.startPoint.y, 'goat_standing');
    
    // Set up player physics
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(300);
    
    // Scale the goat
    this.player.setScale(1.2);
    
    // Adjust the collision body
    this.player.setSize(28, 26);
    this.player.setOffset(10, 14);
    
    // Set up collisions again
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.walls);
    
    // Recreate collision with darts
    this.physics.add.overlap(
      this.player, 
      this.darts, 
      this.hitByDart, 
      (player, dart) => {
        const playerSprite = player as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
        const dartSprite = dart as Phaser.Physics.Arcade.Sprite;
        
        const playerBounds = playerSprite.getBounds();
        const dartBounds = dartSprite.getBounds();
        
        const shrinkX = playerBounds.width * 0.2;
        const shrinkY = playerBounds.height * 0.2;
        
        const smallerPlayerBounds = new Phaser.Geom.Rectangle(
          playerBounds.x + shrinkX,
          playerBounds.y + shrinkY,
          playerBounds.width - (shrinkX * 2),
          playerBounds.height - (shrinkY * 2)
        );
        
        return Phaser.Geom.Rectangle.Overlaps(smallerPlayerBounds, dartBounds);
      }, 
      this
    );
    
    // Recreate collision with end point
    this.physics.add.overlap(
      this.player,
      this.endPoint,
      () => {
        if (!this.gameWon) {
          this.reachEndPoint();
        }
      },
      undefined,
      this
    );
    
    // Recreate collision with dangerous platforms
    this.placedItems.forEach(item => {
      if (item.type === 'spike' && item.gameObject.active) {
        this.physics.add.collider(this.player, item.gameObject, this.hitDangerousPlatform, undefined, this);
      }
    });
  }
  
  // New method for handling collision with dangerous platform
  private hitDangerousPlatform(
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
    _platform: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile
  ): void {
    console.log('Player hit a dangerous platform');
    if (this.gameOver) return; // Prevent multiple triggers
    
    // Player hit a dangerous platform, game over for this round
    this.gameOver = true;
    this.player.setTint(0xff0000);
    this.player.setVelocity(0, 0);
    
    // No longer show the in-game modal, let React handle it
    
    // Notify the React component that the game is over with death type
    this.notifyGameState('gameover', 'spike');
  }
  
  // Utility method to communicate with the React component
  private notifyGameState(status: 'win' | 'playing' | 'reset' | 'gameover' | 'select' | 'placement', deathType?: 'dart' | 'spike'): void {
    console.log(`Notifying game state change: ${status}${deathType ? `, death type: ${deathType}` : ''}`);
    // Create and dispatch a custom event to notify the React app of game state changes
    const event = new CustomEvent('game-state-update', {
      detail: { status, deathType }
    }) as GameStateEvent;
    window.dispatchEvent(event);
  }

  // Create a particle effect when a dart is blocked by a shield
  private createDartBlockEffect(x: number, y: number): void {
    // Create a simple visual effect using rectangles
    for (let i = 0; i < 8; i++) {
      // Create small particles
      const particle = this.add.rectangle(
        x, 
        y, 
        4, 
        4, 
        0xFF9800 // Orange color
      );
      
      // Random direction
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 50;
      
      // Set velocity
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      // Animate the particle
      this.tweens.add({
        targets: particle,
        x: x + vx,
        y: y + vy,
        alpha: 0,
        scale: 0.5,
        duration: 300,
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }
}