// src/client/game/parameters/index.ts
import { GameParameter, ParameterChangeListener } from '../../../shared/types';
import { gameEvents } from '../../utils/GameEventBus';

// Define comprehensive game parameters
export const GAME_PARAMETERS: Record<string, GameParameter> = {
  // Physics parameters
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
  
  // Dart parameters
  dart_speed: {
    key: 'dart_speed',
    defaultValue: 300,
    currentValue: 300,
    normalizedValue: 0,
    min: 150,
    max: 450,
    description: 'Controls how fast the darts move'
  },
  dart_frequency: {
    key: 'dart_frequency',
    defaultValue: 3000,
    currentValue: 3000,
    normalizedValue: 0,
    min: 1500,
    max: 6000,
    description: 'Controls how often darts are fired (milliseconds)'
  },
  dart_wall_height: {
    key: 'dart_wall_height',
    defaultValue: 100,
    currentValue: 100,
    normalizedValue: 0,
    min: 50,
    max: 200,
    description: 'Controls the height of dart walls'
  },
  
  // Platform parameters
  platform_height: {
    key: 'platform_height',
    defaultValue: 20,
    currentValue: 20,
    normalizedValue: 0,
    min: 10,
    max: 40,
    description: 'Controls the height of platforms'
  },
  platform_width: {
    key: 'platform_width',
    defaultValue: 100,
    currentValue: 100,
    normalizedValue: 0,
    min: 50,
    max: 200,
    description: 'Controls the width of platforms'
  },
  
  // Spike parameters
  spike_height: {
    key: 'spike_height',
    defaultValue: 20,
    currentValue: 20,
    normalizedValue: 0,
    min: 10,
    max: 40,
    description: 'Controls the height of spike platforms'
  },
  spike_width: {
    key: 'spike_width',
    defaultValue: 100,
    currentValue: 100,
    normalizedValue: 0,
    min: 50,
    max: 200,
    description: 'Controls the width of spike platforms'
  },
  
  // Oscillator parameters
  oscillator_height: {
    key: 'oscillator_height',
    defaultValue: 20,
    currentValue: 20,
    normalizedValue: 0,
    min: 10,
    max: 40,
    description: 'Controls the height of oscillating platforms'
  },
  oscillator_width: {
    key: 'oscillator_width',
    defaultValue: 100,
    currentValue: 100,
    normalizedValue: 0,
    min: 50,
    max: 200,
    description: 'Controls the width of oscillating platforms'
  },
  oscillator_distance: {
    key: 'oscillator_distance',
    defaultValue: 100,
    currentValue: 100,
    normalizedValue: 0,
    min: 50,
    max: 200,
    description: 'Controls the distance oscillating platforms move'
  },
  
  // Shield parameters
  shield_height: {
    key: 'shield_height',
    defaultValue: 40,
    currentValue: 40,
    normalizedValue: 0,
    min: 20,
    max: 80,
    description: 'Controls the height of shield blocks'
  },
  shield_width: {
    key: 'shield_width',
    defaultValue: 40,
    currentValue: 40,
    normalizedValue: 0,
    min: 20,
    max: 80,
    description: 'Controls the width of shield blocks'
  },
  
  // Gap parameters
  gap_width: {
    key: 'gap_width',
    defaultValue: 100,
    currentValue: 100,
    normalizedValue: 0,
    min: 50,
    max: 200,
    description: 'Controls the width of gaps between ground segments'
  },
  
  // Tilt parameter
  tilt: {
    key: 'tilt',
    defaultValue: 0,
    currentValue: 0,
    normalizedValue: 0,
    min: -45,
    max: 45,
    description: 'Controls the angle (tilt) of platforms in degrees'
  }
};

/**
 * Convert a normalized value (-1 to 1) to actual value
 */
export function convertFromNormalizedValue(parameter: GameParameter, normalizedValue: number): number {
  // Clamp normalized value between -1 and 1
  const clampedNormalizedValue = Math.max(-1, Math.min(1, normalizedValue));
  
  if (clampedNormalizedValue === 0) {
    return parameter.defaultValue;
  } else if (clampedNormalizedValue < 0) {
    // Map -1..0 to min..defaultValue (linear interpolation)
    return parameter.defaultValue + (clampedNormalizedValue * (parameter.defaultValue - parameter.min));
  } else {
    // Map 0..1 to defaultValue..max (linear interpolation)
    return parameter.defaultValue + (clampedNormalizedValue * (parameter.max - parameter.defaultValue));
  }
}

/**
 * Convert an actual value to a normalized value (-1 to 1)
 */
export function convertToNormalizedValue(parameter: GameParameter, actualValue: number): number {
  // Clamp actual value between min and max
  const clampedActualValue = Math.max(parameter.min, Math.min(parameter.max, actualValue));
  
  if (clampedActualValue === parameter.defaultValue) {
    return 0;
  } else if (clampedActualValue < parameter.defaultValue) {
    // Map min..defaultValue to -1..0 (linear interpolation)
    return (clampedActualValue - parameter.defaultValue) / (parameter.defaultValue - parameter.min);
  } else {
    // Map defaultValue..max to 0..1 (linear interpolation)
    return (clampedActualValue - parameter.defaultValue) / (parameter.max - parameter.defaultValue);
  }
}

/**
 * Get the actual value for a parameter by its key
 */
export function getParameterValue(key: string): number {
  if (!GAME_PARAMETERS[key]) {
    console.warn(`Parameter ${key} not found, returning default value`);
    return 0;
  }
  return GAME_PARAMETERS[key].currentValue;
}

/**
 * Get a specific parameter by key
 */
export function getParameter(key: string): GameParameter {
  if (!GAME_PARAMETERS[key]) {
    console.warn(`Parameter ${key} not found, returning default parameter`);
    return {
      key: 'default',
      defaultValue: 0,
      currentValue: 0,
      normalizedValue: 0,
      min: 0,
      max: 0,
      description: 'Default parameter'
    };
  }
  return GAME_PARAMETERS[key];
}

/**
 * Manager class for game parameters
 */
export class ParameterManager {
  private static listeners: Record<string, ParameterChangeListener[]> = {};
  
  /**
   * Update a parameter's normalized value
   */
  public static updateParameterNormalized(key: string, normalizedValue: number): void {
    console.log(`[ParameterManager] Updating parameter ${key} to ${normalizedValue}`);
    
    if (GAME_PARAMETERS[key]) {
      const param = GAME_PARAMETERS[key];
      param.normalizedValue = normalizedValue;
      
      // Use converted value calculation
      param.currentValue = convertFromNormalizedValue(param, normalizedValue);
      
      // Notify listeners
      this.notifyListeners(key, param.currentValue, normalizedValue, param);
      
      // Also notify wildcard listeners
      this.notifyListeners('*', param.currentValue, normalizedValue, param);
      
      // Publish to event bus for components to react
      gameEvents.publish('PARAMETER_UPDATED', {
        key,
        value: param.currentValue,
        normalizedValue: param.normalizedValue,
        parameter: param
      });
    } else {
      console.warn(`Parameter ${key} not found`);
    }
  }
  
  /**
   * Update multiple parameters at once
   */
  public static batchUpdateParameters(updates: {key: string, normalizedValue: number}[]): void {
    console.log('[ParameterManager] Batch updating parameters');
    
    updates.forEach(update => {
      if (GAME_PARAMETERS[update.key]) {
        const param = GAME_PARAMETERS[update.key];
        param.normalizedValue = update.normalizedValue;
        param.currentValue = convertFromNormalizedValue(param, update.normalizedValue);
      }
    });
    
    // Notify wildcard listeners once after all updates
    this.notifyListeners('*', 0, 0, { 
      key: 'batch', 
      defaultValue: 0, 
      currentValue: 0, 
      normalizedValue: 0, 
      min: 0, 
      max: 0, 
      description: 'Batch update' 
    });
    
    // Publish batch update event
    gameEvents.publish('PARAMETERS_BATCH_UPDATED', { updates });
  }
  
  /**
   * Reset all parameters to default values
   */
  public static resetAllParameters(): void {
    console.log('[ParameterManager] Resetting all parameters');
    
    Object.keys(GAME_PARAMETERS).forEach(key => {
      const param = GAME_PARAMETERS[key];
      param.currentValue = param.defaultValue;
      param.normalizedValue = 0;
      
      // Notify listeners
      this.notifyListeners(key, param.currentValue, param.normalizedValue, param);
    });
    
    // Notify wildcard listeners once after reset
    this.notifyListeners('*', 0, 0, { 
      key: 'reset', 
      defaultValue: 0, 
      currentValue: 0, 
      normalizedValue: 0, 
      min: 0, 
      max: 0, 
      description: 'Reset all parameters' 
    });
    
    // Publish reset event
    gameEvents.publish('PARAMETERS_RESET', {});
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