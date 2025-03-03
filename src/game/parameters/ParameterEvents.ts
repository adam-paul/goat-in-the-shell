/**
 * Parameter Events
 * Handles communication of parameter changes between React and Phaser
 */

import { ParameterManager } from './ParameterManager';
import { GameParameter, ParameterChangeEvent } from '../../shared/types';

/**
 * Dispatch a parameter change event to the window
 * This allows React components to listen for parameter changes
 */
export function dispatchParameterChange(
  key: string, 
  currentValue: number, 
  normalizedValue: number,
  description: string
): void {
  const event = new CustomEvent('parameter-change', {
    detail: { key, currentValue, normalizedValue, description }
  }) as ParameterChangeEvent;
  
  window.dispatchEvent(event);
}

/**
 * Initialize parameter event listeners
 * Call this once when the game starts
 */
export function initParameterEvents(): void {
  // Listen for parameter changes and dispatch window events
  ParameterManager.onParameterChanged('*', (newValue: number, normalizedValue: number, parameter: GameParameter) => {
    dispatchParameterChange(
      parameter.key,
      newValue,
      normalizedValue,
      parameter.description
    );
    
    console.log(`Parameter changed: ${parameter.key} = ${newValue} (normalized: ${normalizedValue})`);
  });
  
  // Listen for reset-parameters event from React
  window.addEventListener('reset-parameters', () => {
    ParameterManager.resetAllParameters();
    console.log('All parameters reset to default values');
  });
  
  // Listen for update-parameter event from React
  window.addEventListener('update-parameter', (e: Event) => {
    const event = e as CustomEvent;
    if (event.detail) {
      const { key, normalizedValue } = event.detail;
      ParameterManager.updateParameterNormalized(key, normalizedValue);
      console.log(`Parameter updated from event: ${key} = ${normalizedValue}`);
    }
  });
}

/**
 * Dispatch a batch of parameter updates
 */
export function batchUpdateParameters(updates: { key: string; normalizedValue: number }[]): void {
  ParameterManager.batchUpdateParameters(updates);
}

/**
 * Reset all parameters to default values
 */
export function resetAllParameters(): void {
  ParameterManager.resetAllParameters();
  
  // Also dispatch a reset event
  window.dispatchEvent(new CustomEvent('parameters-reset'));
}