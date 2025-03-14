import Phaser from 'phaser';
import { gameEvents } from '../utils/GameEventBus';
import { ItemType } from '../../shared/types';
import { getParameterValue } from '../game/parameters';

export default class BasicGameScene extends Phaser.Scene {
  // World elements
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private startPoint!: Phaser.GameObjects.Rectangle;
  private endPoint!: Phaser.GameObjects.Rectangle;
  private placedItems: Array<{type: string, x: number, y: number, gameObject: Phaser.GameObjects.GameObject}> = [];
  
  // Preview for item placement
  private itemPreview?: Phaser.GameObjects.Rectangle;
  private itemPlacementMode: boolean = false;
  private itemToPlace: string = '';
  
  // World dimensions
  private worldWidth: number = 2400;
  
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
    
    // Create basic world elements
    this.createWorldElements();
    
    // Set up camera
    this.cameras.main.setBounds(0, 0, this.worldWidth, 800);
    this.cameras.main.setZoom(1);
    
    // Set up event listeners for game state from server
    this.setupEventListeners();
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
  
  private createWorldElements(): void {
    // Create platforms group
    this.platforms = this.physics.add.staticGroup();
    
    // Create ground platform
    this.platforms.create(1200, 780, 'platform')
      .setScale(24, 1)
      .refreshBody();
    
    // Create segmented ground with gaps
    const segmentWidth = 200; 
    const gapWidth = 100; 
    const groundY = 768; 
    
    const totalSegments = Math.ceil(this.worldWidth / (segmentWidth + gapWidth)) + 1;
    
    // Create ground segments with gaps between them
    for (let i = 0; i < totalSegments; i++) {
      const segmentX = i * (segmentWidth + gapWidth) + (segmentWidth / 2);
      const groundSegment = this.platforms.create(segmentX, groundY, 'platform') as Phaser.Physics.Arcade.Sprite;
      groundSegment.setScale(segmentWidth / 100, 1).refreshBody();
    }
    
    // Create the same platform layout as in the old GameScene
    
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
    
    // Create start point (green rectangle)
    this.startPoint = this.add.rectangle(80, 650, 50, 50, 0x00ff00);
    
    // Add START text above the start position
    this.add.text(80, 610, 'START', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Create end point (red rectangle)
    this.endPoint = this.add.rectangle(2320, 120, 50, 50, 0xff0000);
    
    // Add FINISH text above the red box
    this.add.text(2320, 80, 'FINISH', {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }
  
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
        gameEvents.publish('PLACEMENT_CONFIRMED', {
          type: this.itemToPlace,
          x: worldPoint.x,
          y: worldPoint.y
        });
        this.exitPlacementMode();
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
  }
  
  private updateGameState(gameState: any): void {
    console.log('Received game state from server:', gameState);
    
    // Clear existing items if this is a full state refresh
    // We'll treat any state update as a full refresh for simplicity
    this.clearPlacedItems();
    
    // Handle items from server state
    if (gameState.items && Array.isArray(gameState.items)) {
      gameState.items.forEach((item: any) => {
        if (item.position) {
          this.placeItem(item.type, item.position.x, item.position.y);
        } else if (item.x !== undefined && item.y !== undefined) {
          // Handle different formats of item position
          this.placeItem(item.type, item.x, item.y);
        }
      });
    }
    
    // Also try to get items from a deeply nested state structure
    try {
      // Handle different state structures that might come from server
      const possibleItemSources = [
        gameState.state?.items,
        gameState.gameState?.items,
        gameState.state?.gameState?.items,
        gameState.state?.obstacles,
        gameState.payload?.state?.items,
        gameState.payload?.items
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
  }
}