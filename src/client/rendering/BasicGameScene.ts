import Phaser from 'phaser';
import { gameEvents } from '../utils/GameEventBus';
import { ItemType, GameStatus } from '../../shared/types';
import { getParameterValue } from '../game/parameters';
import GoatSprite from './GoatSprite';
import CountdownManager from './CountdownManager';

export default class BasicGameScene extends Phaser.Scene {
  // World elements
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private startPoint!: Phaser.GameObjects.Rectangle;
  private endPoint!: Phaser.GameObjects.Rectangle;
  private placedItems: Array<{type: string, x: number, y: number, gameObject: Phaser.GameObjects.GameObject}> = [];
  
  // Preview for item placement
  private itemPreview?: Phaser.GameObjects.Rectangle;
  private itemPlacementMode: boolean = false;
  private itemToPlace: string = '';
  
  // World dimensions
  private worldWidth: number = 2400;
  
  // Player goat sprite
  private goatSprite?: GoatSprite;
  private clientId?: string;
  
  // Game state tracking
  private gameStatus: GameStatus = 'select';
  private gameStarted: boolean = false;
  private gameOver: boolean = false;
  private gameWon: boolean = false;
  
  // Countdown manager
  private countdownManager!: CountdownManager;
  
  // Physics colliders
  private platformsCollider?: Phaser.Physics.Arcade.Collider;
  private wallsCollider?: Phaser.Physics.Arcade.Collider;
  
  // Constants from original implementation
  private readonly PLAYER_START_X: number = 80;
  private readonly PLAYER_START_Y: number = 650;
  
  constructor() {
    super('BasicGameScene');
  }
  
  preload(): void {
    // Create platform texture
    this.createPlatformTexture();
  }
  
  create(): void {
    console.log('BasicGameScene created');
    
    // Set physics world bounds
    this.physics.world.setBounds(0, 0, this.worldWidth, 800, true, true, true, false);
    
    // Create a blue sky background
    this.add.rectangle(this.worldWidth / 2, 400, this.worldWidth, 800, 0x87CEEB);
    
    // Initialize platforms group (will be populated from server data)
    this.platforms = this.physics.add.staticGroup();
    
    // Initialize walls group
    this.walls = this.physics.add.staticGroup();
    
    // Create placeholder for start/end points (will be updated from server)
    this.startPoint = this.add.rectangle(80, 650, 50, 50, 0x00ff00);
    this.endPoint = this.add.rectangle(2320, 120, 50, 50, 0xff0000);
    
    // Create goat sprite at the start position
    this.goatSprite = new GoatSprite(this, this.PLAYER_START_X, this.PLAYER_START_Y);
    
    // Initialize countdown manager
    this.countdownManager = new CountdownManager(this);
    
    // Set up camera to follow the goat sprite
    this.cameras.main.setBounds(0, 0, this.worldWidth, 800);
    this.cameras.main.startFollow(this.goatSprite.getSprite(), true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    
    // Set up physics for collisions
    this.setupPhysics();
    
    // Pause physics until game starts
    this.physics.pause();
    console.log('Physics paused until countdown completes');
    
    // Set up event listeners for game state from server
    this.setupEventListeners();
  }
  
  /**
   * Set up physics collisions
   */
  private setupPhysics(): void {
    // Skip if there's no goat sprite
    if (!this.goatSprite) return;
    
    const sprite = this.goatSprite.getSprite();
    
    // Configure player physics properties (matching original game)
    sprite.setBounce(0.1);
    sprite.setCollideWorldBounds(false); // Allow falling off the world
    
    // Set player-specific gravity using the correct Arcade Physics type assertion
    if (sprite.body) {
      (sprite.body as Phaser.Physics.Arcade.Body).setGravityY(300);
    }
    
    // Set up collisions between goat and platforms/walls
    this.platformsCollider = this.physics.add.collider(sprite, this.platforms);
    this.wallsCollider = this.physics.add.collider(sprite, this.walls);
    
    // Set up overlap with end point to detect level completion
    this.physics.add.overlap(
      sprite,
      this.endPoint,
      this.handleEndPointCollision,
      undefined,
      this
    );
    
    // Create invisible death zone at the bottom of the world
    const deathZone = this.add.zone(this.worldWidth / 2, 1000, this.worldWidth, 100);
    this.physics.world.enable(deathZone);
    (deathZone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (deathZone.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    
    // Set up death zone collision
    this.physics.add.overlap(
      sprite,
      deathZone,
      this.handleDeathZoneCollision,
      undefined,
      this
    );
    
    console.log('Physics setup complete - player can now jump and collide with platforms');
  }
  
  /**
   * Handle collision with end point (level completion)
   */
  private handleEndPointCollision(): void {
    if (this.gameWon || this.gameOver || !this.gameStarted) return;
    
    console.log('Player reached the end point, level complete!');
    this.gameWon = true;
    
    // Notify game status change
    gameEvents.publish('GAME_STATUS_CHANGE', { status: 'win' });
    
    // Update game status
    this.gameStatus = 'win';
  }
  
  /**
   * Handle collision with death zone (falling off the world)
   */
  private handleDeathZoneCollision(): void {
    if (this.gameWon || this.gameOver || !this.gameStarted) return;
    
    console.log('Player fell through the gap!');
    this.gameOver = true;
    
    // Apply visual effect to goat
    if (this.goatSprite) {
      this.tweens.add({
        targets: this.goatSprite.getSprite(),
        alpha: 0,
        y: '+=200',
        duration: 1000,
        ease: 'Power2'
      });
      
      // Shake the camera slightly
      this.cameras.main.shake(300, 0.01);
    }
    
    // Notify game status change
    gameEvents.publish('GAME_STATUS_CHANGE', {
      status: 'gameover',
      deathType: 'fall'
    });
    
    // Update game status
    this.gameStatus = 'gameover';
  }
  
  private createPlatformTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
    // Draw a simple platform texture (matching original implementation)
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
    
    // Also create a spike/dangerous platform texture
    const spikeGraphics = this.make.graphics({ x: 0, y: 0 });
    
    // Create a texture for dangerous platforms with red tint
    spikeGraphics.fillStyle(0x8B4513); // Base brown color 
    spikeGraphics.fillRect(0, 0, 100, 20);
    spikeGraphics.fillStyle(0x954321); // Slightly reddish brown for top
    spikeGraphics.fillRect(0, 0, 100, 5);
    
    // Add some texture details with a reddish tint
    spikeGraphics.fillStyle(0x7D3027); // Reddish brown for wood grain
    for (let i: number = 0; i < 5; i++) {
      spikeGraphics.fillRect(10 + (i * 20), 8, 5, 10);
    }

    spikeGraphics.generateTexture('dangerous_platform', 100, 20);
    spikeGraphics.destroy();
    
    // Create a wall texture for dart walls
    const wallGraphics = this.make.graphics({ x: 0, y: 0 });
    
    // Draw a simple wall texture
    wallGraphics.fillStyle(0x808080); // Gray color
    wallGraphics.fillRect(0, 0, 20, 100);
    
    // Add some brick-like details
    wallGraphics.lineStyle(1, 0x606060); // Darker gray for mortar lines
    
    // Horizontal lines
    for (let i = 0; i < 5; i++) {
      wallGraphics.moveTo(0, 20 * i);
      wallGraphics.lineTo(20, 20 * i);
    }
    
    // Vertical lines for bricks (staggered pattern)
    for (let i = 0; i < 5; i++) {
      const offsetY = i * 20;
      if (i % 2 === 0) {
        wallGraphics.moveTo(10, offsetY);
        wallGraphics.lineTo(10, offsetY + 20);
      } else {
        wallGraphics.moveTo(0, offsetY);
        wallGraphics.lineTo(0, offsetY + 20);
        wallGraphics.moveTo(20, offsetY);
        wallGraphics.lineTo(20, offsetY + 20);
      }
    }

    wallGraphics.generateTexture('wall', 20, 100);
    wallGraphics.destroy();
  }
  
  // World is now created dynamically from server data
  
  private setupEventListeners(): void {
    // Listen for game state updates from server
    gameEvents.subscribe('SERVER_STATE_UPDATE', (data: any) => {
      this.updateGameState(data);
    });
    
    // Listen for item placement mode
    gameEvents.subscribe('PLACEMENT_MODE_START', (data: {itemType: string}) => {
      this.enterPlacementMode(data.itemType);
    });
    
    // Listen for placement mode exit
    gameEvents.subscribe('PLACEMENT_MODE_EXIT', () => {
      this.exitPlacementMode();
    });
    
    // Listen for placement confirmation
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.itemPlacementMode && this.itemPreview) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        
        // Publish placement confirmation
        gameEvents.publish('PLACEMENT_CONFIRMED', {
          type: this.itemToPlace,
          x: worldPoint.x,
          y: worldPoint.y
        });
        
        // Exit placement mode
        this.exitPlacementMode();
        
        // Explicitly trigger item placed event to start countdown
        console.log('Item placed, triggering countdown');
        gameEvents.publish('ITEM_PLACED', {
          type: this.itemToPlace,
          position: worldPoint
        });
      }
    });
    
    // Listen for parameter updates to refresh preview
    gameEvents.subscribe('PARAMETER_UPDATED', (data: any) => {
      // If we're in placement mode with a preview, recreate the preview
      // to reflect the updated parameter
      if (this.itemPlacementMode && this.itemPreview && this.itemToPlace) {
        // Get current position
        const currentPos = {
          x: this.itemPreview.x,
          y: this.itemPreview.y
        };
        
        // Recreate preview with new parameters
        this.createItemPreview(this.itemToPlace);
        
        // Restore position
        if (this.itemPreview) {
          this.itemPreview.setPosition(currentPos.x, currentPos.y);
        }
      }
    });
    
    // Listen for batch parameter updates
    gameEvents.subscribe('PARAMETERS_BATCH_UPDATED', () => {
      if (this.itemPlacementMode && this.itemToPlace) {
        // Same as above - refresh preview
        const currentPos = this.itemPreview ? {
          x: this.itemPreview.x,
          y: this.itemPreview.y
        } : { x: 400, y: 300 };
        
        this.createItemPreview(this.itemToPlace);
        
        if (this.itemPreview) {
          this.itemPreview.setPosition(currentPos.x, currentPos.y);
        }
      }
    });
    
    // Listen for countdown completion
    gameEvents.subscribe('COUNTDOWN_COMPLETE', () => {
      this.startGame();
    });
    
    // Listen for player input
    gameEvents.subscribe('PLAYER_INPUT', (data: any) => {
      this.handlePlayerInput(data);
    });
    
    // Listen for item placement completion
    gameEvents.subscribe('ITEM_PLACED', () => {
      // Start countdown after item is placed
      gameEvents.publish('START_COUNTDOWN', { duration: 3000 });
    });
  }
  
  /**
   * Start the game after countdown completes
   */
  private startGame(): void {
    console.log('Starting game after countdown');
    this.gameStarted = true;
    this.gameStatus = 'playing';
    
    // Resume physics
    this.physics.resume();
    
    // Notify the game event bus that the game has started
    gameEvents.publish('GAME_STARTED', {});
  }
  
  /**
   * Handle player input - THIS IS FOR IMMEDIATE VISUAL FEEDBACK
   * The server is the source of truth for physics and game state.
   * This method provides immediate visual feedback while waiting for server updates.
   */
  private handlePlayerInput(data: any): void {
    // Skip if game is not active or no goat sprite
    if (!this.gameStarted || this.gameWon || this.gameOver || !this.goatSprite) return;
    
    const sprite = this.goatSprite.getSprite();
    if (!sprite.body) return; // Skip if physics body isn't available
    
    const onGround = sprite.body.touching.down || sprite.body.blocked.down;
    
    // LOCAL VISUAL FEEDBACK ONLY - not actual movement
    // The server will update the real position in the next state update
    console.log('Local visual feedback for input:', data);
    
    // Provide immediate client-side feedback for better responsiveness
    // This won't affect server-side physics but gives the player immediate feedback
    
    // Handle left/right movement for immediate feedback
    if (data.left) {
      // Apply immediate velocity change for responsive feel
      sprite.setVelocityX(-200);
      this.goatSprite.update(
        sprite.x, sprite.y, 
        -200, // Leftward velocity for animation
        sprite.body.velocity.y,
        onGround, true // Force facing left
      );
    } else if (data.right) {
      // Apply immediate velocity change for responsive feel
      sprite.setVelocityX(200);
      this.goatSprite.update(
        sprite.x, sprite.y, 
        200, // Rightward velocity for animation
        sprite.body.velocity.y,
        onGround, false // Force facing right
      );
    } else {
      // Slow down when not pressing left/right
      sprite.setVelocityX(sprite.body.velocity.x * 0.9);
      this.goatSprite.update(
        sprite.x, sprite.y, 
        sprite.body.velocity.x * 0.9, // Slowing down
        sprite.body.velocity.y,
        onGround,
        sprite.flipX // Maintain current facing direction
      );
    }
    
    // Handle jump - provide immediate visual feedback
    if ((data.jump || data.up) && onGround) {
      console.log('Jump input detected while on ground, applying immediate visual feedback');
      
      // Apply immediate upward velocity for responsive feel
      // This matches the original implementation's jump strength
      sprite.setVelocityY(-500); 
      
      // Make sure the server knows we jumped
      // (this was already sent in the input handler, just for clarity)
      console.log('Jump action sent to server');
    }
  }
  
  private updateGameState(gameState: any): void {
    console.log('Received game state from server:', gameState);
    
    // Clear existing items if this is a full state refresh
    // We'll treat any state update as a full refresh for simplicity
    this.clearPlacedItems();
    
    // Find the correct state data structure
    // This handles different ways the state might be nested
    let state = gameState;
    if (gameState.state) state = gameState.state;
    if (gameState.payload?.state) state = gameState.payload.state;
    
    // Store client ID if provided
    if (state.clientId) {
      this.clientId = state.clientId;
    }
    
    // Update game status if provided
    if (state.gameStatus) {
      this.gameStatus = state.gameStatus;
      
      // Update game start state based on status
      if (state.gameStatus === 'playing') {
        this.gameStarted = true;
        this.gameOver = false;
        this.gameWon = false;
      } else if (state.gameStatus === 'gameover') {
        this.gameOver = true;
        this.gameStarted = false;
      } else if (state.gameStatus === 'win') {
        this.gameWon = true;
        this.gameStarted = false;
      }
    }
    
    // Handle the game world data (platforms, start/end points)
    if (state.gameWorld) {
      this.updateWorldFromServer(state.gameWorld);
    }
    
    // Handle players from state
    if (state.players && Array.isArray(state.players)) {
      // Process each player
      state.players.forEach((player: any) => {
        if (!player) return;
        
        // Check if this is our player
        const isLocalPlayer = player.id === this.clientId;
        
        // Update player position in window for debugging
        if (isLocalPlayer) {
          window.playerPosition = {
            x: player.position?.x,
            y: player.position?.y,
            isOnGround: player.onGround
          };
          
          // Update our goat sprite position if available
          if (this.goatSprite && player.position && !this.gameOver && !this.gameWon) {
            console.log(`Updating goat position from server: (${player.position.x}, ${player.position.y}), v:(${player.velocity?.x || 0}, ${player.velocity?.y || 0})`);
            
            // Update goat sprite
            this.goatSprite.update(
              player.position.x,
              player.position.y,
              player.velocity?.x || 0,
              player.velocity?.y || 0,
              player.onGround || false,
              player.facingLeft || false
            );
            
            // If using Phaser physics body, update that too
            const sprite = this.goatSprite.getSprite();
            if (sprite.body) {
              // Use server-provided position and velocity
              
              // First set correct position
              sprite.setPosition(player.position.x, player.position.y);
              
              // Then apply server-provided velocity
              sprite.setVelocity(player.velocity?.x || 0, player.velocity?.y || 0);
              
              // Explicitly check for jumping (significant upward velocity)
              if (player.velocity?.y && player.velocity.y < -50) {
                console.log('Server indicates player is jumping with velocity:', player.velocity.y);
              }
            }
          }
        }
      });
    }
    
    // Handle items from state 
    if (state.items && Array.isArray(state.items)) {
      state.items.forEach((item: any) => {
        if (item.position) {
          // Place the item with all its properties
          this.placeItem(item.type, item.position.x, item.position.y);
          
          // Apply rotation if specified
          if (item.rotation && item.rotation !== 0) {
            // Find the placed item and apply rotation
            const placedItem = this.placedItems.find(p => 
              p.x === item.position.x && p.y === item.position.y && p.type === item.type
            );
            if (placedItem && placedItem.gameObject) {
              (placedItem.gameObject as Phaser.GameObjects.Rectangle).rotation = item.rotation;
            }
          }
        } else if (item.x !== undefined && item.y !== undefined) {
          // Alternative format
          this.placeItem(item.type, item.x, item.y);
        }
      });
    }
    
    // Process projectiles and other state info
    this.processGameState(state);
  }
  
  /**
   * Update the game world based on server data
   */
  private updateWorldFromServer(gameWorld: any): void {
    // Clear existing platforms and walls
    this.platforms.clear(true, true);
    
    // Create walls group if it doesn't exist
    if (!this.walls) {
      this.walls = this.physics.add.staticGroup();
    } else {
      this.walls.clear(true, true);
    }
    
    // Create dart textures if not already done
    if (!this.textures.exists('wall')) {
      this.createWallTexture();
    }
    
    // Update world bounds if provided
    if (gameWorld.worldBounds) {
      this.worldWidth = gameWorld.worldBounds.width;
      this.physics.world.setBounds(0, 0, gameWorld.worldBounds.width, gameWorld.worldBounds.height);
      this.cameras.main.setBounds(0, 0, gameWorld.worldBounds.width, gameWorld.worldBounds.height);
    }
    
    // Update start and end points
    if (gameWorld.startPoint) {
      this.startPoint.setPosition(gameWorld.startPoint.x, gameWorld.startPoint.y);
      
      // Add START text above the start position
      this.add.text(gameWorld.startPoint.x, gameWorld.startPoint.y - 40, 'START', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }
    
    if (gameWorld.endPoint) {
      this.endPoint.setPosition(gameWorld.endPoint.x, gameWorld.endPoint.y);
      
      // Add FINISH text above the end position
      this.add.text(gameWorld.endPoint.x, gameWorld.endPoint.y - 40, 'FINISH', {
        fontSize: '22px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }
    
    // Create platforms from server data
    if (gameWorld.platforms && Array.isArray(gameWorld.platforms)) {
      gameWorld.platforms.forEach((platform: any) => {
        const platformSprite = this.platforms.create(
          platform.position.x, 
          platform.position.y, 
          'platform'
        ) as Phaser.Physics.Arcade.Sprite;
        
        // Scale the platform to match server dimensions
        const widthScale = platform.width / 100; // Default texture width is 100
        const heightScale = platform.height / 20; // Default texture height is 20
        platformSprite.setScale(widthScale, heightScale).refreshBody();
        
        // Apply rotation if specified
        if (platform.rotation && platform.rotation !== 0) {
          platformSprite.setRotation(platform.rotation);
          platformSprite.refreshBody();
        }
      });
    }
    
    // Create dart walls from server data
    if (gameWorld.dartWalls && Array.isArray(gameWorld.dartWalls)) {
      gameWorld.dartWalls.forEach((wall: any) => {
        const wallSprite = this.walls.create(
          wall.position.x,
          wall.position.y,
          'wall'
        ) as Phaser.Physics.Arcade.Sprite;
        
        // Scale the wall to match server dimensions
        // Default texture height is 100
        const heightScale = wall.height / 100;
        wallSprite.setScale(1, heightScale).refreshBody();
      });
    }
  }
  
  /**
   * Create a wall texture for dart walls
   */
  private createWallTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
    // Draw a simple wall texture
    graphics.fillStyle(0x808080); // Gray color
    graphics.fillRect(0, 0, 20, 100);
    
    // Add some brick-like details
    graphics.lineStyle(1, 0x606060); // Darker gray for mortar lines
    
    // Horizontal lines
    for (let i = 0; i < 5; i++) {
      graphics.moveTo(0, 20 * i);
      graphics.lineTo(20, 20 * i);
    }
    
    // Vertical lines for bricks (staggered pattern)
    for (let i = 0; i < 5; i++) {
      const offsetY = i * 20;
      if (i % 2 === 0) {
        graphics.moveTo(10, offsetY);
        graphics.lineTo(10, offsetY + 20);
      } else {
        graphics.moveTo(0, offsetY);
        graphics.lineTo(0, offsetY + 20);
        graphics.moveTo(20, offsetY);
        graphics.lineTo(20, offsetY + 20);
      }
    }

    graphics.generateTexture('wall', 20, 100);
    graphics.destroy();
  }
  
  /**
   * Handle projectiles and other state info from the server
   */
  private processGameState(state: any): void {
    // Handle projectiles (darts) from state
    if (state.projectiles && Array.isArray(state.projectiles)) {
      state.projectiles.forEach((projectile: any) => {
        if (projectile.type === 'dart' && projectile.position) {
          // Render darts as small rectangles
          const dart = this.add.rectangle(
            projectile.position.x,
            projectile.position.y,
            20, // Width
            6,  // Height
            0x303030 // Dark gray
          );
          
          // Store the dart in placedItems so it gets cleaned up on the next update
          this.placedItems.push({
            type: 'dart',
            x: projectile.position.x,
            y: projectile.position.y,
            gameObject: dart
          });
        }
      });
    }
    
    // Update game status if provided
    if (state.gameStatus) {
      console.log(`Game status: ${state.gameStatus}`);
      
      // Handle specific game status events
      switch (state.gameStatus) {
        case 'gameover':
          // Handle game over state
          break;
        case 'win':
          // Handle win state
          break;
      }
    }
    
    // Also try fallback modes for legacy state formats
    try {
      // Handle different state structures that might come from server
      const possibleItemSources = [
        state.gameState?.items,
        state.obstacles,
        state.payload?.items
      ];
      
      // Process each possible source
      for (const items of possibleItemSources) {
        if (items && Array.isArray(items)) {
          items.forEach((item: any) => {
            // Handle different item formats
            const itemType = item.type;
            const x = item.position?.x ?? item.x;
            const y = item.position?.y ?? item.y;
            
            if (itemType && x !== undefined && y !== undefined) {
              this.placeItem(itemType, x, y);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error processing nested game state items:', error);
    }
  }
  
  private enterPlacementMode(itemType: string): void {
    console.log(`Entering placement mode for item type: ${itemType}`);
    this.itemPlacementMode = true;
    this.itemToPlace = itemType;
    
    // Create item preview based on the selected item type
    this.createItemPreview(itemType);
    
    // Update preview position on mouse move
    this.input.on('pointermove', this.updateItemPreview, this);
  }
  
  private createItemPreview(itemType: string): void {
    // Remove existing preview if there is one
    if (this.itemPreview) {
      this.itemPreview.destroy();
      this.itemPreview = undefined;
    }
    
    // Get initial position
    const pointer = this.input.activePointer;
    const worldPoint = pointer ? 
      this.cameras.main.getWorldPoint(pointer.x, pointer.y) : 
      { x: 400, y: 300 };
    
    console.log(`Creating item preview for ${itemType}`);
    
    // Create different previews based on item type
    switch(itemType) {
      case 'platform': {
        // Get platform parameters to match original implementation
        const width = getParameterValue('platform_width');
        const height = getParameterValue('platform_height');
        const tilt = getParameterValue('tilt');
        
        // Create platform preview - green semi-transparent rectangle (matching original)
        this.itemPreview = this.add.rectangle(
          worldPoint.x, 
          worldPoint.y, 
          width, 
          height, 
          0x00ff00, // Green color matches original
          0.5       // Semi-transparent
        );
        
        // Apply current tilt
        if (tilt !== 0) {
          this.itemPreview.setRotation(Phaser.Math.DegToRad(tilt));
        }
        
        console.log(`Created platform preview with width=${width}, height=${height}, tilt=${tilt}`);
        break;
      }
      case 'spike': {
        // Get spike parameters to match original implementation
        const width = getParameterValue('spike_width');
        const height = getParameterValue('spike_height');
        const tilt = getParameterValue('tilt');
        
        // Create spike preview - red semi-transparent rectangle (matching original)
        this.itemPreview = this.add.rectangle(
          worldPoint.x,
          worldPoint.y,
          width,
          height,
          0xff0000, // Red color matches original
          0.5       // Semi-transparent
        );
        
        // Apply current tilt
        if (tilt !== 0) {
          this.itemPreview.setRotation(Phaser.Math.DegToRad(tilt));
        }
        
        console.log(`Created spike preview with width=${width}, height=${height}, tilt=${tilt}`);
        break;
      }
      case 'moving':
      case 'oscillator': {
        // Get oscillator parameters to match original implementation
        const width = getParameterValue('oscillator_width');
        const height = getParameterValue('oscillator_height');
        const tilt = getParameterValue('tilt');
        
        // Create oscillator preview - blue semi-transparent rectangle (matching original)
        this.itemPreview = this.add.rectangle(
          worldPoint.x, 
          worldPoint.y, 
          width, 
          height, 
          0x0000ff, // Blue color matches original
          0.5       // Semi-transparent
        );
        
        // Apply current tilt
        if (tilt !== 0) {
          this.itemPreview.setRotation(Phaser.Math.DegToRad(tilt));
        }
        
        console.log(`Created oscillator preview with width=${width}, height=${height}, tilt=${tilt}`);
        break;
      }
      case 'shield': {
        // Get shield dimensions from parameters
        const width = getParameterValue('shield_width');
        const height = getParameterValue('shield_height');
        
        // Create shield preview matching original implementation - simple orange rectangle
        this.itemPreview = this.add.rectangle(
          worldPoint.x, 
          worldPoint.y, 
          width, 
          height, 
          0xFF9800, // Orange color exactly as in original
          0.5      // Semi-transparent
        );
        console.log(`Created shield preview with width=${width}, height=${height}`);
        break;
      }
      case 'dart_wall': {
        // Get dart wall parameters to match original implementation
        const height = getParameterValue('dart_wall_height');
        
        // Create dart wall preview - red semi-transparent rectangle (matching original)
        this.itemPreview = this.add.rectangle(
          worldPoint.x, 
          worldPoint.y, 
          20, // Fixed width for walls (20px)
          height, 
          0xff0000, // Red color matches original
          0.5       // Semi-transparent
        );
        
        console.log(`Created dart wall preview with height=${height}`);
        break;
      }
      default: {
        // Default fallback preview
        this.itemPreview = this.add.rectangle(
          worldPoint.x, 
          worldPoint.y, 
          50, 
          50, 
          0xffff00, 
          0.5
        );
      }
    }
    
    // Add border outline to make the preview more visible
    if (this.itemPreview) {
      // Store original fill color
      const fillColor = (this.itemPreview as Phaser.GameObjects.Rectangle).fillColor;
      
      // Add stroke (border)
      (this.itemPreview as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xffffff);
      
      // Add a pulsing effect to make the preview more noticeable
      this.tweens.add({
        targets: this.itemPreview,
        alpha: { from: 0.7, to: 0.4 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }
  
  private updateItemPreview(pointer: Phaser.Input.Pointer): void {
    if (this.itemPreview) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.itemPreview.setPosition(worldPoint.x, worldPoint.y);
    }
  }
  
  private exitPlacementMode(): void {
    console.log('Exiting placement mode');
    this.itemPlacementMode = false;
    this.itemToPlace = '';
    
    // Remove preview
    if (this.itemPreview) {
      this.itemPreview.destroy();
      this.itemPreview = undefined;
    }
    
    // Remove pointermove listener
    this.input.off('pointermove', this.updateItemPreview, this);
  }
  
  private placeItem(type: string, x: number, y: number): void {
    console.log(`Placing item: ${type} at (${x}, ${y})`);
    let gameObject: Phaser.GameObjects.GameObject;
    
    try {
      // Get tilt parameter for items that can be tilted
      const tilt = getParameterValue('tilt');
      
      switch(type) {
        case 'platform': {
          // Get platform parameters to match original implementation
          const width = getParameterValue('platform_width');
          const height = getParameterValue('platform_height');
          
          // Create a platform using the platform texture (identical to original)
          gameObject = this.platforms.create(x, y, 'platform');
          
          // Scale according to parameters (just as in original)
          const widthScale = width / 100; // Default texture width is 100
          const heightScale = height / 20; // Default texture height is 20
          (gameObject as Phaser.Physics.Arcade.Sprite).setScale(widthScale, heightScale).refreshBody();
          
          // Apply current tilt (matching original)
          if (tilt !== 0) {
            (gameObject as Phaser.Physics.Arcade.Sprite).setRotation(Phaser.Math.DegToRad(tilt));
            (gameObject as Phaser.Physics.Arcade.Sprite).refreshBody();
          }
          
          console.log(`Platform created with width=${width}, height=${height}, tilt=${tilt}`);
          break;
        }
        case 'spike': {
          // Get spike parameters to match original implementation
          const width = getParameterValue('spike_width');
          const height = getParameterValue('spike_height');
          
          // Create a dangerous platform that looks similar to regular platforms (identical to original)
          try {
            const dangerousPlatform = this.physics.add.sprite(x, y, 'dangerous_platform');
            dangerousPlatform.setImmovable(true);
            (dangerousPlatform.body as Phaser.Physics.Arcade.Body).allowGravity = false;
            
            // Scale according to parameters (just as in original)
            const widthScale = width / 100; // Default texture width is 100
            const heightScale = height / 20; // Default texture height is 20
            dangerousPlatform.setScale(widthScale, heightScale).refreshBody();
            
            // Apply current tilt (matching original)
            if (tilt !== 0) {
              dangerousPlatform.setRotation(Phaser.Math.DegToRad(tilt));
              dangerousPlatform.refreshBody();
            }
            
            // Note: In original, there was a collision handler for player death, but
            // we're just handling visuals in this scene
            
            gameObject = dangerousPlatform;
            console.log(`Dangerous platform created with width=${width}, height=${height}, tilt=${tilt}`);
          } catch (error) {
            console.error('Error creating spike:', error);
            // Fallback to a simple rectangle if sprite creation fails (just like original)
            const spike = this.add.rectangle(x, y, width, height, 0xff0000);
            
            // Apply tilt to the fallback rectangle
            if (tilt !== 0) {
              spike.setRotation(Phaser.Math.DegToRad(tilt));
            }
            
            gameObject = spike;
            console.log('Fallback dangerous platform created');
          }
          break;
        }
        case 'moving':
        case 'oscillator': {
          // Get oscillator parameters to match original implementation
          const width = getParameterValue('oscillator_width');
          const height = getParameterValue('oscillator_height');
          const distance = getParameterValue('oscillator_distance');
          
          try {
            // Create oscillating platform using the regular platform texture (as in original)
            const movingPlatform = this.physics.add.sprite(x, y, 'platform');
            movingPlatform.setImmovable(true);
            (movingPlatform.body as Phaser.Physics.Arcade.Body).allowGravity = false;
            
            // Scale according to parameters
            const widthScale = width / 100; // Default texture width is 100
            const heightScale = height / 20; // Default texture height is 20
            movingPlatform.setScale(widthScale, heightScale).refreshBody();
            
            // Apply tilt if any
            if (tilt !== 0) {
              movingPlatform.setRotation(Phaser.Math.DegToRad(tilt));
              movingPlatform.refreshBody();
            }
            
            // Add oscillation animation exactly as in original
            this.tweens.add({
              targets: movingPlatform,
              x: x + distance,  // Move by parameter distance
              duration: 2000,   // 2 second one-way (4 seconds round trip)
              yoyo: true,       // Back and forth
              repeat: -1,       // Forever
              ease: 'Linear'    // Linear movement
            });
            
            gameObject = movingPlatform;
            console.log(`Oscillating platform created with width=${width}, height=${height}, distance=${distance}`);
          } catch (error) {
            console.error('Error creating oscillator:', error);
            // Fallback to blue rectangle as in original
            const movingPlatform = this.add.rectangle(x, y, width, height, 0x0000ff);
            
            // Apply tilt to fallback rectangle
            if (tilt !== 0) {
              movingPlatform.setRotation(Phaser.Math.DegToRad(tilt));
            }
            
            // Add oscillation to fallback
            this.tweens.add({
              targets: movingPlatform,
              x: x + distance,
              duration: 2000,
              yoyo: true,
              repeat: -1,
              ease: 'Linear'
            });
            
            gameObject = movingPlatform;
            console.log('Fallback oscillating platform created');
          }
          break;
        }
        case 'shield': {
          // Get shield parameters to match original implementation
          const width = getParameterValue('shield_width');
          const height = getParameterValue('shield_height');
          
          try {
            // Create a shield block using platform texture
            // This matches the original which used a platform sprite with tint
            const shieldBlock = this.physics.add.sprite(x, y, 'platform')
              .setDisplaySize(width, height) // Set size based on parameters
              .setTint(0xFF9800);            // Orange color
            
            // Set physics properties to match original
            shieldBlock.setImmovable(true);
            (shieldBlock.body as Phaser.Physics.Arcade.Body).allowGravity = false;
            
            // Note: In real implementation, would add collision with player and darts
            // but we're just handling visuals in this scene
            
            gameObject = shieldBlock;
            console.log(`Shield block created with width=${width}, height=${height}`);
          } catch (error) {
            console.error('Error creating shield block:', error);
            // Fallback to simple rectangle just like original implementation
            const shield = this.add.rectangle(x, y, width, height, 0xFF9800);
            
            gameObject = shield;
            console.log('Fallback shield block created');
          }
          break;
        }
        case 'dart_wall': {
          // Get dart wall parameters to match original implementation
          const height = getParameterValue('dart_wall_height');
          
          try {
            // Create a vertical wall using wall texture
            const wall = this.physics.add.sprite(x, y, 'wall');
            wall.setImmovable(true);
            (wall.body as Phaser.Physics.Arcade.Body).allowGravity = false;
            
            // Scale to match parameter height
            const heightScale = height / 100; // Default texture height is 100
            wall.setScale(1, heightScale).refreshBody();
            
            // Note: In the original, darts would be created and shot from wall
            // but we're just handling visuals in this scene
            
            gameObject = wall;
            console.log(`Dart wall created with height=${height}`);
          } catch (error) {
            console.error('Error creating dart wall:', error);
            // Fallback to a simple rectangle as in original
            const wall = this.add.rectangle(x, y, 20, height, 0x800000);
            
            // Add dart launcher indicators
            const wallDetails = this.add.graphics();
            wallDetails.fillStyle(0x600000);
            
            // Add three circular dart launchers on the wall (visually similar to original)
            const dartPositions = [0.25, 0.5, 0.75]; // Positions along the height
            dartPositions.forEach(pos => {
              wallDetails.fillCircle(x + 8, y - (height/2) + (height * pos), 3);
            });
            
            // Group them
            const container = this.add.container(0, 0, [wall, wallDetails]);
            gameObject = container;
            console.log('Fallback dart wall created');
          }
          break;
        }
        default: {
          // Default yellow rectangle as a fallback
          gameObject = this.add.rectangle(x, y, 50, 50, 0xffaa00);
        }
      }
      
      // Store the placed item
      this.placedItems.push({
        type,
        x,
        y,
        gameObject
      });
      
      console.log(`Successfully placed item: ${type} at (${x}, ${y})`);
    } catch (error) {
      console.error(`Error placing item: ${type} at (${x}, ${y})`, error);
    }
  }
  
  private clearPlacedItems(): void {
    this.placedItems.forEach(item => {
      item.gameObject.destroy();
    });
    this.placedItems = [];
  }
  
  update(): void {
    // Update item preview if in placement mode
    if (this.itemPlacementMode && this.itemPreview) {
      const pointer = this.input.activePointer;
      if (pointer) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.itemPreview.setPosition(worldPoint.x, worldPoint.y);
      }
    }
    
    // Update goat sprite if game is running
    if (this.gameStarted && this.goatSprite && !this.gameOver && !this.gameWon) {
      const sprite = this.goatSprite.getSprite();
      if (!sprite.body) return; // Skip if physics body isn't available
      
      const onGround = sprite.body.touching.down || sprite.body.blocked.down;
      
      // Update animations based on current state
      this.goatSprite.update(
        sprite.x, sprite.y,
        sprite.body.velocity.x, sprite.body.velocity.y,
        onGround,
        sprite.flipX
      );
      
      // Publish player position to event bus for network synchronization
      gameEvents.publish('PLAYER_POSITION_UPDATE', {
        x: sprite.x,
        y: sprite.y,
        velocityX: sprite.body.velocity.x,
        velocityY: sprite.body.velocity.y,
        onGround: onGround,
        facingLeft: sprite.flipX
      });
    }
  }
  
  /**
   * Clean up resources when scene is shut down
   */
  shutdown(): void {
    // Clean up the countdown manager
    if (this.countdownManager) {
      this.countdownManager.destroy();
    }
    
    // Clean up the goat sprite
    if (this.goatSprite) {
      this.goatSprite.destroy();
    }
    
    // Clear all event listeners
    // This is important to prevent memory leaks
    gameEvents.clear('SERVER_STATE_UPDATE');
    gameEvents.clear('PLACEMENT_MODE_START');
    gameEvents.clear('PLACEMENT_MODE_EXIT');
    gameEvents.clear('PARAMETER_UPDATED');
    gameEvents.clear('PARAMETERS_BATCH_UPDATED');
    gameEvents.clear('COUNTDOWN_COMPLETE');
    gameEvents.clear('PLAYER_INPUT');
    gameEvents.clear('ITEM_PLACED');
    
    // Clear all placed items
    this.clearPlacedItems();
  }
}