// src/client/services/AIService.ts 
// Stub implementation until we migrate the service properly
import { CommandResponse, ParameterModification } from '../../shared/types';

/**
 * This is a temporary stub for the AIService
 * It will be fully implemented as part of the server migration
 */
export class AIService {
  /**
   * Send a command to the AI service
   * @param command The command to send
   * @returns A promise that resolves to the AI response
   */
  public static async sendCommand(command: string): Promise<CommandResponse> {
    console.log(`[AIService Stub] Sending command: ${command}`);
    
    // In the real implementation, this would call the AI API
    return {
      response: `Stub response for command: ${command}`,
      success: true,
      parameter_modifications: []
    };
  }
  
  /**
   * Validate parameter modifications
   * @param mods The modifications to validate
   * @returns The validated modifications
   */
  public static validateParameterModifications(mods: ParameterModification[]): ParameterModification[] {
    console.log(`[AIService Stub] Validating parameter modifications:`, mods);
    
    // In the real implementation, this would validate the modifications
    // For now, just return the input
    return mods;
  }
}