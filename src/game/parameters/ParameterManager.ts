import { 
  GAME_PARAMETERS, 
  convertFromNormalizedValue,
  convertToNormalizedValue
} from './ParameterMap';
import { GameParameter, ParameterChangeListener } from '../../types';

/**
 * Manager class that handles parameter state and notifications
 */
export class ParameterManager {
  // Store parameter change listeners
  private static listeners: Record<string, ParameterChangeListener[]> = {};
  
  /**
   * Get a parameter by key
   */
  static getParameter(key: string): GameParameter {
    if (!GAME_PARAMETERS[key]) {
      console.warn(`Parameter ${key} not found`);
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
    
    return { ...GAME_PARAMETERS[key] };
  }
  
  /**
   * Update a parameter using a normalized value (-1 to 1)
   */
  static updateParameterNormalized(key: string, normalizedValue: number): void {
    if (!GAME_PARAMETERS[key]) {
      console.warn(`Cannot update parameter ${key}: not found`);
      return;
    }
    
    // Clamp normalized value between -1 and 1
    const clampedNormalizedValue = Math.max(-1, Math.min(1, normalizedValue));
    
    // Calculate the new actual value
    const parameter = GAME_PARAMETERS[key];
    const newValue = convertFromNormalizedValue(parameter, clampedNormalizedValue);
    
    // Update both values
    parameter.normalizedValue = clampedNormalizedValue;
    parameter.currentValue = newValue;
    
    console.log(`Parameter ${key} updated to ${newValue} (normalized: ${clampedNormalizedValue})`);
    
    // Notify listeners
    this.notifyParameterChanged(key, newValue, clampedNormalizedValue, parameter);
  }
  
  /**
   * Update a parameter using an actual value
   */
  static updateParameterActual(key: string, actualValue: number): void {
    if (!GAME_PARAMETERS[key]) {
      console.warn(`Cannot update parameter ${key}: not found`);
      return;
    }
    
    const parameter = GAME_PARAMETERS[key];
    
    // Clamp actual value between min and max
    const clampedActualValue = Math.max(parameter.min, Math.min(parameter.max, actualValue));
    
    // Calculate the new normalized value
    const newNormalizedValue = convertToNormalizedValue(parameter, clampedActualValue);
    
    // Update both values
    parameter.currentValue = clampedActualValue;
    parameter.normalizedValue = newNormalizedValue;
    
    console.log(`Parameter ${key} updated to ${clampedActualValue} (normalized: ${newNormalizedValue})`);
    
    // Notify listeners
    this.notifyParameterChanged(key, clampedActualValue, newNormalizedValue, parameter);
  }
  
  /**
   * Reset a specific parameter to its default value
   */
  static resetParameter(key: string): void {
    if (!GAME_PARAMETERS[key]) {
      console.warn(`Cannot reset parameter ${key}: not found`);
      return;
    }
    
    const parameter = GAME_PARAMETERS[key];
    parameter.currentValue = parameter.defaultValue;
    parameter.normalizedValue = 0;
    
    console.log(`Parameter ${key} reset to default value ${parameter.defaultValue}`);
    
    // Notify listeners
    this.notifyParameterChanged(key, parameter.defaultValue, 0, parameter);
  }
  
  /**
   * Reset all parameters to their default values
   */
  static resetAllParameters(): void {
    Object.keys(GAME_PARAMETERS).forEach(key => {
      this.resetParameter(key);
    });
    
    console.log('All parameters reset to default values');
  }
  
  /**
   * Add a listener for parameter changes
   */
  static onParameterChanged(key: string, listener: ParameterChangeListener): void {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    
    this.listeners[key].push(listener);
  }
  
  /**
   * Remove a listener for parameter changes
   */
  static removeParameterListener(key: string, listener: ParameterChangeListener): void {
    if (!this.listeners[key]) {
      return;
    }
    
    this.listeners[key] = this.listeners[key].filter(l => l !== listener);
  }
  
  /**
   * Notify all listeners about a parameter change
   */
  private static notifyParameterChanged(
    key: string, 
    newValue: number, 
    normalizedValue: number, 
    parameter: GameParameter
  ): void {
    if (!this.listeners[key]) {
      return;
    }
    
    this.listeners[key].forEach(listener => {
      try {
        listener(newValue, normalizedValue, parameter);
      } catch (error) {
        console.error(`Error in parameter change listener for ${key}:`, error);
      }
    });
    
    // Also notify global listeners (key = '*')
    if (this.listeners['*']) {
      this.listeners['*'].forEach(listener => {
        try {
          listener(newValue, normalizedValue, parameter);
        } catch (error) {
          console.error(`Error in global parameter change listener for ${key}:`, error);
        }
      });
    }
  }
  
  /**
   * Add a batch of parameter updates using normalized values
   * All updates will be applied together, and notifications will be sent at the end
   */
  static batchUpdateParameters(updates: { key: string; normalizedValue: number }[]): void {
    // Store pending notifications
    const pendingNotifications: { 
      key: string; 
      newValue: number; 
      normalizedValue: number; 
      parameter: GameParameter 
    }[] = [];
    
    // Apply all updates
    updates.forEach(update => {
      const { key, normalizedValue } = update;
      
      if (!GAME_PARAMETERS[key]) {
        console.warn(`Cannot update parameter ${key}: not found`);
        return;
      }
      
      // Clamp normalized value between -1 and 1
      const clampedNormalizedValue = Math.max(-1, Math.min(1, normalizedValue));
      
      // Calculate the new actual value
      const parameter = GAME_PARAMETERS[key];
      const newValue = convertFromNormalizedValue(parameter, clampedNormalizedValue);
      
      // Update both values
      parameter.normalizedValue = clampedNormalizedValue;
      parameter.currentValue = newValue;
      
      // Add to pending notifications
      pendingNotifications.push({
        key,
        newValue,
        normalizedValue: clampedNormalizedValue,
        parameter: { ...parameter }
      });
    });
    
    // Send all notifications
    pendingNotifications.forEach(notification => {
      const { key, newValue, normalizedValue, parameter } = notification;
      this.notifyParameterChanged(key, newValue, normalizedValue, parameter);
    });
    
    console.log(`Batch updated ${pendingNotifications.length} parameters`);
  }
}

// Function removed to avoid duplication with dispatchParameterChange in ParameterEvents
// Import moved to top of file