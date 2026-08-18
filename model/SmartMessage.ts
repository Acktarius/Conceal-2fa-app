/**
 * Copyright (c) 2025, Acktarius
 *
 * SmartMessage System for Conceal Network
 *
 * This system enables structured commands in blockchain transactions
 * to support 2FA management, vault management, and other modules
 * without requiring blockchain changes.
 */

export interface SmartMessage {
  version: string;
  command: string;
  paymentId?: string;
}

export interface SmartMessageResult {
  success: boolean;
  message?: string;
  data?: any;
}

export class SmartMessageParser {
  private static readonly VERSION = '1.0';
  private static readonly SMART_MESSAGE_PREFIX = '{';
  private static readonly SMART_MESSAGE_SUFFIX = '}';

  /**
   * Check if a message is a smart message
   */
  static isSmartMessage(message: string): boolean {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const trimmed = message.trim();
    return trimmed.startsWith(SmartMessageParser.SMART_MESSAGE_PREFIX) && trimmed.endsWith(SmartMessageParser.SMART_MESSAGE_SUFFIX);
  }

  /** `{2FA,c,...}` / `{2Fa,d,...}` — module and action are case-insensitive. */
  static is2FASmartMessage(message: string): boolean {
    if (!SmartMessageParser.isSmartMessage(message)) {
      return false;
    }
    const parts = message.trim().slice(1, -1).split(',');
    if (parts.length < 2) {
      return false;
    }
    const module = parts[0].trim().toLowerCase();
    const action = parts[1].trim().toLowerCase();
    return module === '2fa' && (action === 'c' || action === 'd' || action === 'u');
  }

  /**
   * Parse a smart message from string
   */
  static parse(message: string): SmartMessage | null {
    try {
      if (!SmartMessageParser.isSmartMessage(message)) {
        return null;
      }

      // Extract command from {command} format
      const command = message.trim().slice(1, -1); // Remove { and }

      return {
        version: SmartMessageParser.VERSION,
        command: command,
        paymentId: undefined, // Will be extracted from transaction context
      };
    } catch (error) {
      console.error('Error parsing smart message:', error);
      return null;
    }
  }

  /**
   * Encode a smart message command with semi-serialized actions
   */
  static encode(module: string, action: string, ...data: string[]): string {
    // Semi-serialize actions to reduce blockchain payload
    const actionMap: { [key: string]: string } = {
      create: 'c',
      update: 'u',
      delete: 'd',
      complete: 'x', // for to-do completion
      authorize: 'a', // for agent authorization
      execute: 'e', // for agent execution
      register: 'r', // for trust registration
      verify: 'v', // for trust verification
      revoke: 'k', // for trust revocation
    };

    const serializedAction = actionMap[action] || action;
    const commandParts = [module, serializedAction, ...data];
    const command = commandParts.join(',');
    return `{${command}}`;
  }

  /**
   * Process a smart message and execute the appropriate handler
   * This is called by TransactionsExplorer.processSmartMessage
   */
  static async process(message: SmartMessage, wallet: any): Promise<SmartMessageResult> {
    try {
      const parts = message.command.split(',');
      if (parts.length < 2) {
        return { success: false, message: 'Invalid command format' };
      }

      const module = parts[0].trim();
      const action = parts[1].trim();
      const data = parts.slice(2);

      if (module.toLowerCase() === '2fa') {
        return await SmartMessageParser.process2FA(action, data, wallet);
      }

      switch (module) {
        case 'vault':
          return await SmartMessageParser.processVault(action, data, wallet);

        case 'to-do':
          return await SmartMessageParser.processToDo(action, data, wallet);

        case 'medical':
          return await SmartMessageParser.processMedical(action, data, wallet);

        case 'agent':
          return await SmartMessageParser.processAgent(action, data, wallet);

        case 'trust':
          return await SmartMessageParser.processTrust(action, data, wallet);

        case 'contact':
          return await SmartMessageParser.processContact(action, data, wallet);

        default:
          return { success: false, message: `Unknown module: ${module}` };
      }
    } catch (error) {
      console.error('Error processing smart message:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Process 2FA module commands
   * Commands: {2FA,c,name,issuer,sharedKey[,algorithm,digits,period]}, {2FA,u,hash,updateData}, {2FA,d,hash}
   * Optional after sharedKey: algorithm (SHA1|SHA256|SHA512), digits (6|7|8), period (30|60)
   */
  private static async process2FA(action: string, data: string[], wallet: any): Promise<SmartMessageResult> {
    try {
      switch (action.trim().toLowerCase()) {
        case 'c': {
          // create
          if (data.length < 3) {
            return { success: false, message: 'Invalid 2FA create command' };
          }
          const [name, issuer, sharedKey, algorithmStr, digitsStr, periodStr] = data;
          return await SmartMessageParser.parse2FA('c', wallet, name, issuer, sharedKey, algorithmStr, digitsStr, periodStr);
        }

        case 'u': {
          // update
          if (data.length < 2) {
            return { success: false, message: 'Invalid 2FA update command' };
          }
          const [hash, updateData] = data;
          return await SmartMessageParser.update2FA(hash, updateData, wallet);
        }

        case 'd': {
          // delete
          if (data.length < 1) {
            return { success: false, message: 'Invalid 2FA delete command' };
          }
          const [deleteHash] = data;
          return await SmartMessageParser.parse2FA('d', wallet, deleteHash);
        }

        default:
          return { success: false, message: `Unknown 2FA action: ${action}` };
      }
    } catch (error) {
      console.error('Error processing 2FA command:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Encode 2FA command to send to blockchain
   * @param action - 'c' for create, 'd' for delete
   * @param data - For create: [name, issuer, sharedKey, algorithm?, digits?, period?], For delete: [hash]
   */
  static async encode2FA(action: 'c' | 'd', ...data: string[]): Promise<SmartMessageResult> {
    try {
      if (action === 'c') {
        // Create command: requires 3 fields, optional 3 more (algorithm, digits, period)
        if (data.length < 3) {
          return { success: false, message: 'Create command requires name, issuer, and sharedKey' };
        }
        const [name, issuer, sharedKey, algorithm, digits, period] = data;

        // Always encode optional params when they are non-default, to preserve algorithm fidelity
        const alg = algorithm && algorithm.trim() ? algorithm.trim() : 'SHA1';
        const dig = digits && digits.trim() ? digits.trim() : '6';
        const per = period && period.trim() ? period.trim() : '30';

        // Include optional fields whenever they differ from defaults so the receiver can restore them
        const parts: string[] = [name, issuer, sharedKey];
        if (alg !== 'SHA1' || dig !== '6' || per !== '30') {
          parts.push(alg, dig, per);
        }

        const encodedMessage = SmartMessageParser.encode('2FA', 'create', ...parts);
        return {
          success: true,
          message: `2FA create command encoded successfully`,
          data: encodedMessage,
        };
      }
      if (action === 'd') {
        // Delete command: requires 1 field
        if (data.length < 1) {
          return { success: false, message: 'Delete command requires hash' };
        }
        const [hash] = data;
        console.log('2FA ENCODE DELETE:', { hash });

        const encodedMessage = SmartMessageParser.encode('2FA', 'delete', hash);
        return {
          success: true,
          message: `2FA delete command encoded successfully`,
          data: encodedMessage,
        };
      }
      return { success: false, message: `Invalid action: ${action}. Use 'c' for create or 'd' for delete` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Update 2FA service from smart message
   */
  private static async update2FA(hash: string, updateData: string, wallet: any): Promise<SmartMessageResult> {
    try {
      // Blue-Print: Implement 2FA update from smart message
      // 1. Find existing SharedKey by hash
      // 2. Parse updateData (e.g., "name:new-name")
      // 3. Update local storage
      // 4. Return success

      console.log('2FA UPDATE:', { hash, updateData });

      return {
        success: true,
        message: `2FA service updated successfully`,
        data: { hash, updateData },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Parse 2FA command from blockchain
   * @param action - 'c' for create, 'd' for delete
   * @param wallet - Wallet instance for local storage operations
   * @param data - For create: [name, issuer, sharedKey, algorithm?, digits?, period?], For delete: [hash]
   */
  private static async parse2FA(action: 'c' | 'd', wallet: any, ...data: string[]): Promise<SmartMessageResult> {
    try {
      if (action === 'c') {
        // Create command: requires 3 fields; optional 4th=algorithm, 5th=digits, 6th=period
        if (data.length < 3) {
          return { success: false, message: 'Create command requires name, issuer, and sharedKey' };
        }
        const [name, issuer, sharedKey, algorithmStr, digitsStr, periodStr] = data;

        // Optional algorithm: SHA1 (default), SHA256, SHA512
        let algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1';
        if (algorithmStr != null && algorithmStr.trim() !== '') {
          const a = algorithmStr.trim().toUpperCase();
          if (a === 'SHA1' || a === 'SHA256' || a === 'SHA512') algorithm = a;
        }

        // Optional digits: 6 (default), 7, 8
        let digits: 6 | 7 | 8 = 6;
        if (digitsStr != null && digitsStr.trim() !== '') {
          const d = parseInt(digitsStr.trim(), 10);
          if (d === 6 || d === 7 || d === 8) digits = d;
        }

        // Optional period: 30 (default), 60
        let period: 30 | 60 = 30;
        if (periodStr != null && periodStr.trim() !== '') {
          const p = parseInt(periodStr.trim(), 10);
          if (p === 60) period = 60;
        }

        return {
          success: true,
          message: `2FA service ${name} imported successfully`,
          data: { name, issuer, sharedKey, algorithm, digits, period },
        };
      }
      if (action === 'd') {
        // Delete command: requires 1 field
        if (data.length < 1) {
          return { success: false, message: 'Delete command requires hash' };
        }
        const [hash] = data;
        console.log('2FA PARSE DELETE:', { hash });

        // Storage operation is handled downstream by SmartMessageService.handle2FADelete
        // which receives { hash } from result.data via TransactionsExplorer.processSmartMessage
        return {
          success: true,
          message: `2FA service deleted successfully`,
          data: { hash },
        };
      }
      return { success: false, message: `Invalid action: ${action}. Use 'c' for create or 'd' for delete` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Process Vault module commands
   * Commands: {vault,c,type,name,category,data,description}, {vault,u,hash,updateData}, {vault,d,hash}
   */
  private static async processVault(action: string, data: string[], wallet: any): Promise<SmartMessageResult> {
    try {
      switch (action) {
        case 'c': // create
          // Blue-Print: Implement vault creation
          console.log('VAULT CREATE:', { data });
          return {
            success: true,
            message: `Vault item created`,
            data: { action, data },
          };

        case 'u': // update
          // Blue-Print: Implement vault update
          console.log('VAULT UPDATE:', { data });
          return {
            success: true,
            message: `Vault item updated`,
            data: { action, data },
          };

        case 'd': // delete
          // Blue-Print: Implement vault deletion
          console.log('VAULT DELETE:', { data });
          return {
            success: true,
            message: `Vault item deleted`,
            data: { action, data },
          };

        default:
          return { success: false, message: `Unknown vault action: ${action}` };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Process To-Do module commands
   * Commands: {to-do,c,title,priority,category,due_date,description}, {to-do,x,hash}, {to-do,u,hash,updateData}, {to-do,d,hash}
   */
  private static async processToDo(action: string, data: string[], wallet: any): Promise<SmartMessageResult> {
    try {
      switch (action) {
        case 'c': // create
          // Blue-Print: Implement to-do creation
          console.log('TO-DO CREATE:', { data });
          return {
            success: true,
            message: `To-do item created`,
            data: { action, data },
          };

        case 'x': // complete
          // Blue-Print: Implement to-do completion
          console.log('TO-DO COMPLETE:', { data });
          return {
            success: true,
            message: `To-do item completed`,
            data: { action, data },
          };

        case 'u': // update
          // Blue-Print: Implement to-do update
          console.log('TO-DO UPDATE:', { data });
          return {
            success: true,
            message: `To-do item updated`,
            data: { action, data },
          };

        case 'd': // delete
          // Blue-Print: Implement to-do deletion
          console.log('TO-DO DELETE:', { data });
          return {
            success: true,
            message: `To-do item deleted`,
            data: { action, data },
          };

        default:
          return { success: false, message: `Unknown to-do action: ${action}` };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Process Medical module commands
   * Commands: {medical,c,type,data,privacy_level}, {medical,u,hash,updateData}, {medical,d,hash}
   */
  private static async processMedical(action: string, data: string[], wallet: any): Promise<SmartMessageResult> {
    try {
      switch (action) {
        case 'c': // create
          // Blue-Print: Implement medical record creation
          console.log('MEDICAL CREATE:', { data });
          return {
            success: true,
            message: `Medical record created`,
            data: { action, data },
          };

        case 'u': // update
          // Blue-Print: Implement medical record update
          console.log('MEDICAL UPDATE:', { data });
          return {
            success: true,
            message: `Medical record updated`,
            data: { action, data },
          };

        case 'd': // delete
          // Blue-Print: Implement medical record deletion
          console.log('MEDICAL DELETE:', { data });
          return {
            success: true,
            message: `Medical record deleted`,
            data: { action, data },
          };

        default:
          return { success: false, message: `Unknown medical action: ${action}` };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Process Agent module commands
   * Commands: {agent,a,paymentId,amount,conditions}, {agent,e,hash,params}, {agent,k,hash}
   */
  private static async processAgent(action: string, data: string[], wallet: any): Promise<SmartMessageResult> {
    try {
      switch (action) {
        case 'a': // authorize
          // Blue-Print: Implement agent authorization
          console.log('AGENT AUTHORIZE:', { data });
          return {
            success: true,
            message: `Agent authorized`,
            data: { action, data },
          };

        case 'e': // execute
          // Blue-Print: Implement agent execution
          console.log('AGENT EXECUTE:', { data });
          return {
            success: true,
            message: `Agent executed`,
            data: { action, data },
          };

        case 'k': // revoke
          // Blue-Print: Implement agent revocation
          console.log('AGENT REVOKE:', { data });
          return {
            success: true,
            message: `Agent revoked`,
            data: { action, data },
          };

        default:
          return { success: false, message: `Unknown agent action: ${action}` };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Process Trust module commands
   * Commands: {trust,r,paymentId,permissions,expiration}, {trust,v,paymentId}, {trust,k,paymentId}
   */
  private static async processTrust(action: string, data: string[], wallet: any): Promise<SmartMessageResult> {
    try {
      switch (action) {
        case 'r': // register
          // Blue-Print: Implement trust registration
          console.log('TRUST REGISTER:', { data });
          return {
            success: true,
            message: `Trust relationship registered`,
            data: { action, data },
          };

        case 'v': // verify
          // Blue-Print: Implement trust verification
          console.log('TRUST VERIFY:', { data });
          return {
            success: true,
            message: `Trust relationship verified`,
            data: { action, data },
          };

        case 'k': // revoke
          // Blue-Print: Implement trust revocation
          console.log('TRUST REVOKE:', { data });
          return {
            success: true,
            message: `Trust relationship revoked`,
            data: { action, data },
          };

        default:
          return { success: false, message: `Unknown trust action: ${action}` };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Process Contact module commands
   * Commands: {contact,c,name,email,ccx_address,paymentId}, {contact,u,hash,updateData}, {contact,d,hash}
   */
  private static async processContact(action: string, data: string[], wallet: any): Promise<SmartMessageResult> {
    try {
      switch (action) {
        case 'c': {
          // create
          if (data.length < 4) {
            return {
              success: false,
              message: 'Invalid contact create command - requires name, email, ccx_address, paymentId',
            };
          }
          const [name, email, ccxAddress, paymentId] = data;
          return await SmartMessageParser.createContact(name, email, ccxAddress, paymentId, wallet);
        }

        case 'u': {
          // update
          if (data.length < 2) {
            return { success: false, message: 'Invalid contact update command - requires hash and updateData' };
          }
          const [hash, updateData] = data;
          return await SmartMessageParser.updateContact(hash, updateData, wallet);
        }

        case 'd': {
          // delete
          if (data.length < 1) {
            return { success: false, message: 'Invalid contact delete command - requires hash' };
          }
          const [deleteHash] = data;
          return await SmartMessageParser.deleteContact(deleteHash, wallet);
        }

        default:
          return { success: false, message: `Unknown contact action: ${action}` };
      }
    } catch (error) {
      console.error('Error processing contact command:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Create contact from smart message
   */
  private static async createContact(
    name: string,
    email: string,
    ccxAddress: string,
    paymentId: string,
    wallet: any
  ): Promise<SmartMessageResult> {
    try {
      // Blue-Print: Implement contact creation
      // 1. Validate email format
      // 2. Validate CCX address format (ccx7, 98 chars)
      // 3. Create Contact object
      // 4. Add to local storage
      // 5. Set isLocal: false, toBePush: false
      // 6. Return success

      console.log('CONTACT CREATE:', {
        name,
        email,
        ccxAddress: ccxAddress.substring(0, 10) + '...',
        paymentId: paymentId.substring(0, 10) + '...',
      });

      return {
        success: true,
        message: `Contact ${name} created successfully`,
        data: { name, email, ccxAddress, paymentId },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Update contact from smart message
   */
  private static async updateContact(hash: string, updateData: string, wallet: any): Promise<SmartMessageResult> {
    try {
      // Blue-Print: Implement contact update
      // 1. Find existing Contact by hash
      // 2. Parse updateData (e.g., "name:new-name,email:new-email")
      // 3. Update local storage
      // 4. Return success

      console.log('CONTACT UPDATE:', { hash, updateData });

      return {
        success: true,
        message: `Contact updated successfully`,
        data: { hash, updateData },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Delete contact from smart message
   */
  private static async deleteContact(hash: string, wallet: any): Promise<SmartMessageResult> {
    try {
      // Blue-Print: Implement contact deletion
      // 1. Find existing Contact by hash
      // 2. Remove from local storage
      // 3. Return success

      console.log('CONTACT DELETE:', { hash });

      return {
        success: true,
        message: `Contact deleted successfully`,
        data: { hash },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

/**
 * Trust Manager for PaymentId-based verification
 */
export class TrustManager {
  private static trustedPaymentIds: Set<string> = new Set();

  /**
   * Validate a smart message against trust requirements
   */
  static validateMessage(message: SmartMessage, paymentId: string): { valid: boolean; reason?: string } {
    // Blue-Print: Implement trust validation
    // 1. Check if paymentId is trusted
    // 2. Verify permissions for the operation
    // 3. Check if trust relationship is expired
    // 4. Return validation result

    if (!TrustManager.isTrustedPaymentId(paymentId)) {
      return { valid: false, reason: 'Untrusted paymentId' };
    }

    if (!TrustManager.hasPermission(paymentId, message.command)) {
      return { valid: false, reason: 'Insufficient permissions' };
    }

    if (TrustManager.isTrustExpired(paymentId)) {
      return { valid: false, reason: 'Trust relationship expired' };
    }

    return { valid: true };
  }

  /**
   * Check if a paymentId is trusted
   */
  private static isTrustedPaymentId(paymentId: string): boolean {
    // Blue-Print: Implement trusted paymentId check
    return TrustManager.trustedPaymentIds.has(paymentId);
  }

  /**
   * Check if paymentId has permission for the operation
   */
  private static hasPermission(paymentId: string, command: string): boolean {
    // Blue-Print: Implement permission checking
    // Parse command to extract module and action
    // Check against stored permissions for the paymentId
    return true; // Placeholder
  }

  /**
   * Check if trust relationship is expired
   */
  private static isTrustExpired(paymentId: string): boolean {
    // Blue-Print: Implement trust expiration check
    // Check stored expiration date for the paymentId
    return false; // Placeholder
  }

  /**
   * Register a new trusted paymentId
   */
  static registerTrustedPaymentId(paymentId: string, permissions: string[], expiration?: Date): void {
    // Blue-Print: Implement trust registration
    TrustManager.trustedPaymentIds.add(paymentId);
    console.log('Trusted paymentId registered:', paymentId);
  }

  /**
   * Revoke trust for a paymentId
   */
  static revokeTrust(paymentId: string): void {
    // Blue-Print: Implement trust revocation
    TrustManager.trustedPaymentIds.delete(paymentId);
    console.log('Trust revoked for paymentId:', paymentId);
  }
}

export default SmartMessageParser;
