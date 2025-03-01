/**
 * Parameter Map defining game physics and object parameters
 * Follows a normalized value system where:
 * - 0 represents current default values
 * - -1 represents half of default value
 * - 1 represents twice the default value
 */

/**
 * Interface for a single game parameter
 */
export interface GameParameter {
  key: string;
  defaultValue: number;
  currentValue: number;
  normalizedValue: number;
  min: number;
  max: number;
  description: string;
}

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
 * Game parameters with default, min, and max values
 */
export const GAME_PARAMETERS: Record<string, GameParameter> = {
  // Physics parameters
  gravity: {
    key: 'gravity',
    defaultValue: 300,
    currentValue: 300,
    normalizedValue: 0,
    min: 150,
    max: 600,
    description: 'Controls how quickly objects fall'
  },
  
  // Dart parameters
  dart_speed: {
    key: 'dart_speed',
    defaultValue: 300,
    currentValue: 300,
    normalizedValue: 0,
    min: 150,
    max: 600,
    description: 'Controls how fast darts move horizontally'
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