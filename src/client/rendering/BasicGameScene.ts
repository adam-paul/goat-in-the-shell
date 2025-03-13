import Phaser from 'phaser';
import { gameEvents } from '../utils/GameEventBus';
import { ItemType } from '../../shared/types';

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
      if (gameState.state && gameState.state.items && Array.isArray(gameState.state.items)) {
        gameState.state.items.forEach((item: any) => {
          if (item.position) {
            this.placeItem(item.type, item.position.x, item.position.y);
          } else if (item.x !== undefined && item.y !== undefined) {
            this.placeItem(item.type, item.x, item.y);
          }
        });
      }
    } catch (error) {
      console.error('Error processing nested game state items:', error);
    }
  }
  
  private enterPlacementMode(itemType: string): void {
    console.log(`Entering placement mode for item type: ${itemType}`);
    this.itemPlacementMode = true;
    this.itemToPlace = itemType;
    
    // Create item preview
    this.itemPreview = this.add.rectangle(0, 0, 100, 20, 0x0088ff, 0.5);
    
    // Update preview position on mouse move
    this.input.on('pointermove', this.updateItemPreview, this);
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
      switch(type) {
        case 'platform': {
          gameObject = this.platforms.create(x, y, 'platform')
            .setScale(2, 0.5)
            .refreshBody();
          break;
        }
        case 'spike': {
          gameObject = this.add.triangle(x, y, 0, 20, 10, 0, 20, 20, 0xff0000);
          break;
        }
        case 'moving':
        case 'oscillator': {
          gameObject = this.add.rectangle(x, y, 100, 20, 0x00ffff);
          break;
        }
        case 'shield': {
          gameObject = this.add.rectangle(x, y, 50, 100, 0x8800ff);
          break;
        }
        case 'dart_wall': {
          gameObject = this.add.rectangle(x, y, 20, 100, 0xff0000);
          break;
        }
        default: {
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