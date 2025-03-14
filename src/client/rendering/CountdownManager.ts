/**
 * CountdownManager.ts - Manages the countdown display in the game
 */
import Phaser from 'phaser';
import { gameEvents } from '../utils/GameEventBus';

export default class CountdownManager {
  private scene: Phaser.Scene;
  private countdownText?: Phaser.GameObjects.Text;
  private countdownTimer?: Phaser.Time.TimerEvent;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Listen for countdown events
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for countdown events
   */
  private setupEventListeners(): void {
    // Listen for countdown start events
    gameEvents.subscribe('START_COUNTDOWN', (data: { duration?: number }) => {
      this.startCountdown(data.duration || 3000);
    });
  }
  
  /**
   * Start the countdown display
   * @param duration Duration of countdown in milliseconds (default: 3000)
   */
  startCountdown(duration: number = 3000): void {
    // Remove any existing countdown
    this.clearCountdown();
    
    // Create countdown text in the center of the screen
    this.countdownText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      '3',
      {
        fontSize: '64px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    
    // Start countdown
    let countdown = 3;
    
    // Calculate delay based on duration (default 3000ms for 3 seconds)
    const delayPerCount = Math.floor(duration / countdown);
    
    // Create a timer event that fires every second (or adjusted based on duration)
    this.countdownTimer = this.scene.time.addEvent({
      delay: delayPerCount,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          // Update countdown text
          if (this.countdownText) {
            this.countdownText.setText(countdown.toString());
          }
        } else {
          // Countdown finished, dispatch event to start the game
          gameEvents.publish('COUNTDOWN_COMPLETE', {});
          
          // Clean up
          this.clearCountdown();
        }
      },
      callbackScope: this,
      repeat: 2 // 3 times total - 3, 2, 1
    });
  }
  
  /**
   * Clear the countdown display and timer
   */
  clearCountdown(): void {
    // Clear any existing timer
    if (this.countdownTimer) {
      this.countdownTimer.remove();
      this.countdownTimer = undefined;
    }
    
    // Destroy the text if it exists
    if (this.countdownText) {
      this.countdownText.destroy();
      this.countdownText = undefined;
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearCountdown();
  }
}