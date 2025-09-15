import { config } from '../config';

export class BlockchainService {
  private static readonly DEFAULT_NODE = 'https://explorer.conceal.network/daemon/';
  private static isInitialized = false;

  static async initialize(): Promise<boolean> {
    try {
      // Test connection to node
      const response = await fetch(`${this.DEFAULT_NODE}getheight`);
      if (!response.ok) {
        throw new Error('Failed to connect to node');
      }
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  static async getHeight(): Promise<number> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return 0; // Return 0 if offline
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.DEFAULT_NODE}getheight`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn('Failed to get blockchain height, returning 0');
        return 0;
      }
      const data = await response.json();
      return data.height || 0;
    } catch (error) {
      console.warn('Failed to get blockchain height, returning 0:', error.message);
      return 0;
    }
  }

  static async getBalance(address: string): Promise<number> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return 0; // Return 0 if offline
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.DEFAULT_NODE}getbalance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('Failed to get balance, returning 0');
        return 0;
      }

      const data = await response.json();
      return data.availableBalance || 0;
    } catch (error) {
      console.warn('Failed to get balance, returning 0:', error.message);
      return 0;
    }
  }
}