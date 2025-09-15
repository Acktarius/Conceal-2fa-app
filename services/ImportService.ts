import { Alert } from 'react-native';
import { Wallet } from '../model/Wallet';
import { KeysRepository } from '../model/KeysRepository';
import { Cn, CnUtils } from '../model/Cn';
import { BlockchainExplorerRpcDaemon } from '../model/blockchain/BlockchainExplorerRPCDaemon';
import { Mnemonic } from '../model/Mnemonic';
import { RNCamera } from 'react-native-camera';
import { CoinUri } from '../model/CoinUri';

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
      
      // Get mnemonic from user
      const mnemonicSeed = await this.getMnemonicFromUser();
      
      // Detect language and decode mnemonic
      const detectedMnemonicLang = Mnemonic.detectLang(mnemonicSeed.trim());
      if (!detectedMnemonicLang) {
        throw new Error('Could not detect mnemonic language');
      }

      const mnemonic_decoded = Mnemonic.mn_decode(mnemonicSeed.trim(), detectedMnemonicLang);
      if (!mnemonic_decoded) {
        throw new Error('Invalid mnemonic phrase');
      }

      // Create keys and wallet
      const keys = Cn.create_address(mnemonic_decoded);
      const newWallet = new Wallet();
      newWallet.keys = KeysRepository.fromPriv(keys.spend.sec, keys.view.sec);

      // Set creation height slightly behind current height
      const height = Math.max(0, currentHeight - 10);
      newWallet.lastHeight = height;
      newWallet.creationHeight = height;

      // Create wallet object
      const wallet = new Wallet();
      wallet.keys = { 
        priv: { spend: keys.spend.sec, view: keys.view.sec }, 
        pub: { spend: keys.spend.pub, view: keys.view.pub } 
      };

      wallet.creationHeight = height;

      return wallet;
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
      
      // Create wallet object
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

  private static async getMnemonicFromUser(): Promise<string> {
    return new Promise((resolve, reject) => {
      Alert.prompt(
        'Enter Seed Phrase',
        'Please enter your 25-word seed phrase',
        [
          {
            text: 'Cancel',
            onPress: () => reject(new Error('USER_CANCELLED')),
            style: 'cancel',
          },
          {
            text: 'Import',
            onPress: (mnemonic?: string) => {
              if (!mnemonic) {
                reject(new Error('No mnemonic provided'));
                return;
              }
              resolve(mnemonic);
            },
          },
        ],
        'plain-text',
        '', // default value
        'default'
      );
    });
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