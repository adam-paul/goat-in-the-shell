// src/client/game/parameters/index.ts
// Stub implementation until we migrate the parameter system
import { GameParameter, ParameterChangeListener } from '../../../shared/types';

// Define default game parameters
export const GAME_PARAMETERS: Record<string, GameParameter> = {
  gravity: {
    key: 'gravity',
    defaultValue: 980,
    currentValue: 980,
    normalizedValue: 0,
    min: 490,
    max: 1470,
    description: 'Controls how quickly the goat falls'
  },
  jump_power: {
    key: 'jump_power',
    defaultValue: 500,
    currentValue: 500,
    normalizedValue: 0,
    min: 250,
    max: 750,
    description: 'Controls how high the goat jumps'
  },
  dart_speed: {
    key: 'dart_speed',
    defaultValue: 300,
    currentValue: 300,
    normalizedValue: 0,
    min: 150,
    max: 450,
    description: 'Controls how fast the darts move'
  },
  platform_width: {
    key: 'platform_width',
    defaultValue: 200,
    currentValue: 200,
    normalizedValue: 0,
    min: 100,
    max: 300,
    description: 'Controls the width of platforms'
  }
};

/**
 * Manager class for game parameters
 */
export class ParameterManager {
  private static listeners: Record<string, ParameterChangeListener[]> = {};
  
  /**
   * Update a parameter's normalized value
   */
  public static updateParameterNormalized(key: string, normalizedValue: number): void {
    console.log(`[ParameterManager Stub] Updating parameter ${key} to ${normalizedValue}`);
    
    if (GAME_PARAMETERS[key]) {
      const param = GAME_PARAMETERS[key];
      param.normalizedValue = normalizedValue;
      
      // Calculate raw value from normalized value
      const range = param.max - param.min;
      param.currentValue = param.defaultValue + (range * normalizedValue);
      
      // Notify listeners
      this.notifyListeners(key, param.currentValue, normalizedValue, param);
      
      // Also notify wildcard listeners
      this.notifyListeners('*', param.currentValue, normalizedValue, param);
    } else {
      console.warn(`Parameter ${key} not found`);
    }
  }
  
  /**
   * Reset all parameters to default values
   */
  public static resetAllParameters(): void {
    console.log('[ParameterManager Stub] Resetting all parameters');
    
    Object.keys(GAME_PARAMETERS).forEach(key => {
      const param = GAME_PARAMETERS[key];
      param.currentValue = param.defaultValue;
      param.normalizedValue = 0;
      
      // Notify listeners
      this.notifyListeners(key, param.currentValue, param.normalizedValue, param);
      
      // Also notify wildcard listeners
      this.notifyListeners('*', param.currentValue, param.normalizedValue, param);
    });
  }
  
  /**
   * Register a listener for parameter changes
   */
  public static onParameterChanged(key: string, listener: ParameterChangeListener): void {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    
    this.listeners[key].push(listener);
  }
  
  /**
   * Notify listeners of parameter changes
   */
  private static notifyListeners(key: string, value: number, normalizedValue: number, parameter: GameParameter): void {
    if (this.listeners[key]) {
      this.listeners[key].forEach(listener => {
        listener(value, normalizedValue, parameter);
      });
    }
  }
}