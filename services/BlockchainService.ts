import { config } from '../config';

export class BlockchainService {
  private static readonly DEFAULT_NODE = 'https://node.conceal.network:16000/';
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
      await this.initialize();
    }

    try {
      const response = await fetch(`${this.DEFAULT_NODE}getheight`);
      if (!response.ok) {
        throw new Error('Failed to get blockchain height');
      }
      const data = await response.json();
      return data.height;
    } catch (error) {
      console.error('Failed to get blockchain height:', error);
      throw error;
    }
  }

  static async getBalance(address: string): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await fetch(`${this.DEFAULT_NODE}getbalance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error('Failed to get balance');
      }

      const data = await response.json();
      return data.availableBalance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }
}