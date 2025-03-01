/**
 * AIService.ts
 * Handles communication with the AI backend for game parameter commands
 */

// Interface for parameter modification returned by the AI
export interface ParameterModification {
  parameter: string;
  normalized_value: number;
}

// Response interface for the AI command endpoint
export interface CommandResponse {
  response: string;
  success: boolean;
  parameter_modifications: ParameterModification[];
}

// Request interface for sending commands to the AI
export interface CommandRequest {
  command: string;
}

// Service class for communicating with the AI backend
export class AIService {
  private static readonly API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  /**
   * Send a command to the AI backend
   * @param command The text command to send
   * @returns Promise with the response including parameter modifications
   */
  public static async sendCommand(command: string): Promise<CommandResponse> {
    try {
      const response = await fetch(`${this.API_URL}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command } as CommandRequest),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json() as CommandResponse;
      
      // Log successful responses for debugging
      console.log('AI response:', data);
      
      return data;
    } catch (error) {
      // Log errors and rethrow
      console.error('Error in AIService.sendCommand:', error);
      throw error;
    }
  }
  
  /**
   * Get available parameters and their descriptions
   * @returns Promise with the parameters information
   */
  public static async getParameters(): Promise<{parameters: {key: string, description: string, range: string}[]}> {
    try {
      const response = await fetch(`${this.API_URL}/parameters`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in AIService.getParameters:', error);
      throw error;
    }
  }
  
  /**
   * Validate parameter modifications from the AI
   * This adds an extra layer of validation on the client side
   * @param mods The parameter modifications to validate
   * @returns The validated parameter modifications
   */
  public static validateParameterModifications(
    mods: ParameterModification[]
  ): ParameterModification[] {
    // Valid parameter keys
    const validParameters = [
      'gravity', 'dart_speed', 'dart_frequency', 'dart_wall_height',
      'platform_height', 'platform_width', 'spike_height', 'spike_width',
      'oscillator_height', 'oscillator_width', 'shield_height', 'shield_width',
      'gap_width', 'tilt'
    ];
    
    // Filter and validate each modification
    return mods
      .filter(mod => {
        // Check if the parameter is valid
        if (!validParameters.includes(mod.parameter)) {
          console.warn(`Invalid parameter: ${mod.parameter}`);
          return false;
        }
        
        // Check if normalized value is in valid range
        if (mod.normalized_value < -1 || mod.normalized_value > 1) {
          console.warn(`Invalid value for ${mod.parameter}: ${mod.normalized_value}`);
          return false;
        }
        
        return true;
      })
      .map(mod => ({
        parameter: mod.parameter,
        // Ensure the normalized value is within bounds
        normalized_value: Math.max(-1, Math.min(1, mod.normalized_value))
      }));
  }
}