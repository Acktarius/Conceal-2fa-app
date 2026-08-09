import type { TOTPAlgorithm, TOTPDigits, TOTPPeriod } from '../TOTPService';

/**
 * Interface for TOTP (Time-based One-Time Password) service
 */
export interface ITOTPService {
  generateTOTP(secret: string, timestamp?: number, algorithm?: TOTPAlgorithm, digits?: TOTPDigits, period?: TOTPPeriod): Promise<string>;

  generateTOTPForTimeStep(secret: string, timeStep: number, algorithm?: TOTPAlgorithm, digits?: TOTPDigits): Promise<string>;

  getTimeRemaining(period?: TOTPPeriod): number;
}
