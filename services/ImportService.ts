import { Alert } from 'react-native';
import { Wallet } from '../model/Wallet';
import { KeysRepository } from '../model/KeysRepository';
import { Cn, CnUtils } from '../model/Cn';
import { BlockchainExplorerRpcDaemon } from '../model/blockchain/BlockchainExplorerRPCDaemon';
import { Mnemonic } from '../model/Mnemonic';
import { RNCamera } from 'react-native-camera';
import { CoinUri } from '../model/CoinUri';
import { WalletStorageManager } from './WalletStorageManager';
import { BiometricService } from './BiometricService';

export class ImportService {
  private static blockchainExplorer: BlockchainExplorerRpcDaemon | null = null;

  static async importWallet(): Promise<Wallet> {
    try {
      // First, initialize blockchain explorer if needed
      if (!this.blockchainExplorer) {
        this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await this.blockchainExplorer.initialize();
      }

      while (true) { // Loop to allow returning to method selection on cancel
        try {
          // Let user choose import method
          const importMethod = await new Promise<'mnemonic' | 'qr' | 'cancel'>((resolve) => {
            Alert.alert(
              'Import Method',
              'How would you like to import your wallet?',
              [
                {
                  text: 'Cancel',
                  onPress: () => resolve('cancel'),
                  style: 'cancel',
                },
                {
                  text: 'Seed Phrase',
                  onPress: () => resolve('mnemonic'),
                },
                {
                  text: 'QR Code',
                  onPress: () => resolve('qr'),
                },
              ],
              { cancelable: true, onDismiss: () => resolve('cancel') }
            );
          });

          if (importMethod === 'cancel') {
            throw new Error('USER_CANCELLED');
          }

          if (importMethod === 'mnemonic') {
            return await this.importFromMnemonic();
          } else {
            return await this.importFromQR();
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'USER_CANCELLED') {
            throw error; // Propagate cancel up to wallet creation
          }
          // For other errors, show error and loop back to method selection
          Alert.alert(
            'Import Error',
            error instanceof Error ? error.message : 'Failed to import wallet',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_CANCELLED') {
        throw error; // Propagate cancel up to wallet creation
      }
      console.error('Error in importWallet:', error);
      throw new Error('Failed to import wallet');
    }
  }

  private static async importFromMnemonic(): Promise<Wallet> {
    try {
      // Get current blockchain height
      const currentHeight = await this.blockchainExplorer!.getHeight();
      
      // Get mnemonic and creation height from user using our custom modal
      const { mnemonicSeed, providedHeight } = await this.getMnemonicFromUser();
      
      // Detect language and decode mnemonic
      const detectedMnemonicLang = Mnemonic.detectLang(mnemonicSeed.trim());
      if (!detectedMnemonicLang) {
        throw new Error('Could not detect mnemonic language');
      }

      const mnemonic_decoded = Mnemonic.mn_decode(mnemonicSeed.trim(), detectedMnemonicLang);
      if (!mnemonic_decoded) {
        throw new Error('Invalid mnemonic phrase');
      }

      // Create keys from mnemonic
      const keys = Cn.create_address(mnemonic_decoded);

      // Get the existing local wallet to upgrade
      const existingWallet = await WalletStorageManager.getWallet();
      if (!existingWallet) {
        throw new Error('No existing wallet found to upgrade');
      }

      // Upgrade the existing wallet with blockchain keys
      existingWallet.keys = { 
        priv: { spend: keys.spend.sec, view: keys.view.sec }, 
        pub: { spend: keys.spend.pub, view: keys.view.pub } 
      };

      // Calculate creation height based on user input
      let creationHeight = 0;
      if (providedHeight > 0) {
        const assumeCreationHeight = Math.max(0, providedHeight - 10);
        if (assumeCreationHeight < 0) {
          creationHeight = 0;
        } else if (assumeCreationHeight > currentHeight) {
          creationHeight = currentHeight;
        } else {
          creationHeight = assumeCreationHeight;
        }
      }

      existingWallet.creationHeight = creationHeight;
      existingWallet.lastHeight = creationHeight;

      // Encrypt and save the upgraded wallet based on current authentication mode
      await this.saveImportedWallet(existingWallet);

      return existingWallet;
    } catch (error) {
      console.error('Error importing from mnemonic:', error);
      throw error;
    }
  }

  private static async importFromQR(): Promise<Wallet> {
    try {
      // Get current blockchain height
      const currentHeight = await this.blockchainExplorer!.getHeight();
      
      // Get QR data
      const qrResult = await this.scanQRCode();
      const txDetails = CoinUri.decodeWallet(qrResult);
      
      if (!txDetails || (!txDetails.spendKey && !txDetails.mnemonicSeed)) {
        throw new Error('Invalid QR code format');
      }

      let keys;
      let seed = '';

      if (txDetails.mnemonicSeed) {
        // If QR contains mnemonic, detect language and decode
        const detectedMnemonicLang = Mnemonic.detectLang(txDetails.mnemonicSeed.trim());
        if (!detectedMnemonicLang) {
          throw new Error('Could not detect mnemonic language in QR code');
        }

        const mnemonic_decoded = Mnemonic.mn_decode(txDetails.mnemonicSeed.trim(), detectedMnemonicLang);
        if (!mnemonic_decoded) {
          throw new Error('Invalid mnemonic in QR code');
        }

        keys = Cn.create_address(mnemonic_decoded);
        seed = mnemonic_decoded;
      } else if (txDetails.spendKey) {
        // If QR contains spend key
        const viewKey = txDetails.viewKey || Cn.generate_keys(CnUtils.cn_fast_hash(txDetails.spendKey)).sec;
        keys = {
          spend: { sec: txDetails.spendKey, pub: '' },
          view: { sec: viewKey, pub: '' },
          public_addr: txDetails.address || ''
        };
      } else {
        throw new Error('Invalid QR code data');
      }

      // Use provided height or default to current height - 10
      const height = txDetails.height ? parseInt(txDetails.height.toString()) : Math.max(0, currentHeight - 10);
      
      // Create wallet object with blockchain keys (not local-only)
      const wallet = new Wallet();
      wallet.keys = { 
        priv: { spend: keys.spend.sec, view: keys.view.sec }, 
        pub: { spend: keys.spend.pub, view: keys.view.pub } 
      };
      wallet.creationHeight = height;

      return wallet;
    } catch (error) {
      console.error('Error importing from QR:', error);
      throw error;
    }
  }

  private static async getMnemonicFromUser(): Promise<{ mnemonicSeed: string; providedHeight: number }> {
    return new Promise((resolve, reject) => {
      // Get the seed input context from global state
      const seedInputContext = (global as any).seedInputContext;
      
      if (!seedInputContext) {
        throw new Error('Seed input context not available. App must be properly initialized.');
      }

      // Use our custom modal
      seedInputContext.showSeedInputModal(
        (seedPhrase: string, creationHeight?: number) => {
          resolve({ mnemonicSeed: seedPhrase, providedHeight: creationHeight || 0 });
        },
        () => {
          reject(new Error('USER_CANCELLED'));
        }
      );
    });
  }

  private static async saveImportedWallet(wallet: Wallet): Promise<void> {
    try {
      if (await BiometricService.isBiometricChecked()) {
        // Biometric mode: Encrypt with biometric key
        console.log('IMPORT: Encrypting imported wallet with biometric key');
        
        // Use existing biometric salt (should already exist from wallet creation)
        const existingSalt = await WalletStorageManager.getBiometricSalt();
        if (!existingSalt) {
          throw new Error('Biometric salt not found. Wallet must be properly initialized first.');
        }
        
        // Derive biometric key and encrypt
        const biometricKey = await WalletStorageManager.deriveBiometricKey();
        if (!biometricKey) {
          throw new Error('Failed to generate biometric key for imported wallet encryption');
        }
        await WalletStorageManager.saveEncryptedWallet(wallet, biometricKey);
      } else {
        // Password mode: Prompt for password to encrypt imported wallet
        console.log('IMPORT: Password mode - requesting password for imported wallet');
        const passwordPromptContext = (global as any).passwordPromptContext;
        if (!passwordPromptContext) {
          throw new Error('Password prompt context not available');
        }
        
        const password = await passwordPromptContext.showPasswordPromptAlert(
          'Secure Imported Wallet',
          'Enter a password to secure your imported wallet:'
        );
        
        if (!password) {
          throw new Error('Password required to secure imported wallet');
        }
        
        await WalletStorageManager.saveEncryptedWallet(wallet, password);
        
        // Generate biometric salt from user password (for future biometric enablement)
        await WalletStorageManager.generateAndStoreBiometricSalt(password);
      }
    } catch (error) {
      console.error('Error saving imported wallet:', error);
      throw error;
    }
  }

  private static async scanQRCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      // The QR scanning component should call this when a code is scanned:
      const handleBarCodeRead = ({ type, data }: { type: string; data: string }) => {
        if (type === RNCamera.Constants.BarCodeType.qr) {
          resolve(data);
        } else {
          reject(new Error('Invalid QR code type'));
        }
      };

      // The component should also provide a way to cancel scanning
      const handleCancel = () => {
        reject(new Error('USER_CANCELLED'));
      };

      // TODO: Show your QR scanning UI component here
      // You'll need to implement this in your React Native UI
      throw new Error('QR scanning UI not implemented');
    });
  }
} 