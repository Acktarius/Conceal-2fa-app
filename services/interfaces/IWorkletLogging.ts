/**
 * KISS Global Worklet Logging - Just 6 simple functions
 */

export interface IWorkletLogging {
  /**
   * The worklet runtime for direct access
   */
  readonly runtime: any;

  /**
   * Log 1 string message
   */
  logging1string(message: string): void;

  /**
   * Log 2 string messages
   */
  logging2string(message1: string, message2: string): void;

  /**
   * Log 2 numbers
   */
  logging2numbers(num1: number, num2: number): void;

  /**
   * Log 1 string and 1 number
   */
  logging1string1number(message: string, num: number): void;

  /**
   * Log with 1 string variable passed to worklet
   */
  loggingWithString(template: string, variable: string): void;

  /**
   * Log with 1 number variable passed to worklet
   */
  loggingWithNumber(template: string, variable: number): void;

  /**
   * Log with 2 string variables passed to worklet %s %d
   */
  loggingWith_s_d(template: string, variable1: any, variable2: any): void;
}

/**
 * Global worklet logging instance
 */
export let globalWorkletLogging: IWorkletLogging | null = null;

/**
 * Set the global worklet logging implementation
 */
export function setGlobalWorkletLogging(implementation: IWorkletLogging): void {
  globalWorkletLogging = implementation;
}

/**
 * Get the current global worklet logging instance
 */
export function getGlobalWorkletLogging(): IWorkletLogging {
  if (!globalWorkletLogging) {
    throw new Error('Global worklet logging not initialized');
  }
  return globalWorkletLogging;
}
