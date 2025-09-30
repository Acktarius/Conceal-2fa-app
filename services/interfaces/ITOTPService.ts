/**
 * Interface for TOTP (Time-based One-Time Password) service
 */
export interface ITOTPService {
  /**
   * Generate a TOTP code for the current time step
   * @param secret - The secret key for TOTP generation
   * @returns Promise resolving to the 6-digit TOTP code
   */
  generateTOTP(secret: string): Promise<string>;

  /**
   * Generate a TOTP code for a specific time step
   * @param secret - The secret key for TOTP generation
   * @param timeStep - The specific time step to generate code for
   * @returns Promise resolving to the 6-digit TOTP code
   */
  generateTOTPForTimeStep(secret: string, timeStep: number): Promise<string>;

  /**
   * Get the time remaining for the current TOTP code
   * @returns Time remaining in seconds
   */
  getTimeRemaining(): number;
}
