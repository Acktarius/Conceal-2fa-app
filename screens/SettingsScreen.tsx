/**
 *     Copyright (c) 2025, Acktarius
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CustomNodeModal } from '../components/CustomNodeModal';
import { ExpandableSection } from '../components/ExpandableSection';
import { ExpSectionToggle } from '../components/ExpSectionToggle';
import GestureNavigator from '../components/GestureNavigator';
import Header from '../components/Header';
import { PasswordChangeAlert } from '../components/PasswordChangeAlert';
import { PasswordCreationAlert } from '../components/PasswordCreationAlert';
import QRScannerModal from '../components/QRScannerModal';
import { TermsModal } from '../components/TermsModal';
import { UnlockWalletAlert } from '../components/UnlockWalletAlert';
import { config } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { useWallet } from '../contexts/WalletContext';
import { CnUtils } from '../model/Cn';
import { CoinUri } from '../model/CoinUri';
import { Mnemonic } from '../model/Mnemonic';
import { WalletRepository } from '../model/WalletRepository';
import packageJson from '../package.json';
import { BiometricService } from '../services/BiometricService';
import { ExportService } from '../services/ExportService';
import { StorageService } from '../services/StorageService';
import { WalletService } from '../services/WalletService';
import { WalletStorageManager } from '../services/WalletStorageManager';
import { getGlobalWorkletLogging } from '../services/interfaces/IWorkletLogging';

// verifyOldPassword function moved here to avoid circular dependencies

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const [blockchainSync, setBlockchainSync] = useState(false);
  const [autoShare, setAutoShare] = useState(false);
  const [biometricAuth, setBiometricAuth] = useState(false);
  const [showBlockchainSyncToggle, setShowBlockchainSyncToggle] = useState(false);

  // Trust Anchor (Payment ID Whitelist) state
  const [paymentIdWhiteList, setPaymentIdWhiteList] = useState<string[]>([]);
  const [isTrustAnchorExpanded, setIsTrustAnchorExpanded] = useState(false);

  // Custom Node Modal state
  const [showCustomNodeModal, setShowCustomNodeModal] = useState(false);
  const [currentNodeUrl, setCurrentNodeUrl] = useState('');
  const [nodeDisplayName, setNodeDisplayName] = useState('Default Node');
  const [showPasswordChangeAlert, setShowPasswordChangeAlert] = useState(false);
  const [showUnlockWalletAlert, setShowUnlockWalletAlert] = useState(false);
  const [showPasswordCreationAlert, setShowPasswordCreationAlert] = useState(false);
  const [showClearDataOptions, setShowClearDataOptions] = useState(false);
  const [showCleanLocalStorageOptions, setShowCleanLocalStorageOptions] = useState(false);
  const [revokedKeys, setRevokedKeys] = useState<any[]>([]);
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [is2FADisplayExpanded, setIs2FADisplayExpanded] = useState(false);
  const [current2FADisplaySetting, setCurrent2FADisplaySetting] = useState('off');
  const [isBroadcastExpanded, setIsBroadcastExpanded] = useState(false);
  const [broadcastAddress, setBroadcastAddress] = useState('');
  const [showBroadcastQRScanner, setShowBroadcastQRScanner] = useState(false);
  const [biometricAction, setBiometricAction] = useState<'enable' | 'disable'>('enable');
  const [manualPaymentId, setManualPaymentId] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isEditingHeight, setIsEditingHeight] = useState(false);
  const [customHeightInput, setCustomHeightInput] = useState('');
  const [customRescanHeight, setCustomRescanHeight] = useState<number | null>(null);

  // Theme options
  const themeOptions = [
    { id: 'light', label: 'Light', icon: 'sunny', color: '#FFD700' },
    { id: 'orange', label: 'Orange', icon: 'flame', color: '#FF8C00' },
    { id: 'velvet', label: 'Velvet', icon: 'flower', color: '#8852d2' },
    { id: 'dark', label: 'Dark', icon: 'moon', color: '#2C2C2C' },
  ];

  // 2FA Display options
  const futureDisplayOptions = [
    { id: 'off', label: 'OFF', icon: 'eye-off', color: '#6B7280' },
    { id: '5s', label: '5s', icon: 'time', color: '#F59E0B' },
    { id: '10s', label: '10s', icon: 'time', color: '#F59E0B' },
    { id: 'on', label: 'ON', icon: 'eye', color: '#10B981' },
  ];

  // Get current theme ID based on currentThemeId
  const getCurrentThemeId = () => {
    return currentThemeId;
  };

  // Handle theme selection
  const handleThemeSelect = (themeId: string) => {
    setTheme(themeId);
    // Collapse section after selection
    setIsThemeExpanded(false);
  };

  // Handle 2FA display selection
  const handle2FADisplaySelect = async (settingId: string) => {
    try {
      const settings = await StorageService.getSettings();
      await StorageService.saveSettings({
        ...settings,
        futureCodeDisplay: settingId,
      });
      setCurrent2FADisplaySetting(settingId);
      // Collapse section after selection
      setIs2FADisplayExpanded(false);
    } catch (error) {
      console.error('Error saving 2FA display setting:', error);
    }
  };

  // Handle broadcast QR scan
  const handleBroadcastQRScan = (data: string) => {
    try {
      const decoded = CoinUri.decodeTx(data);
      if (decoded && decoded.address) {
        setBroadcastAddress(decoded.address);
        saveBroadcastAddress(decoded.address);
        setShowBroadcastQRScanner(false);
        setIsBroadcastExpanded(false);
      }
    } catch (error) {
      console.error('Error decoding QR data:', error);
      Alert.alert('Error', 'Invalid QR code. Please try again.');
    }
  };

  // Handle broadcast QR scanner close
  const handleBroadcastQRClose = () => {
    setShowBroadcastQRScanner(false);
    // Don't collapse the section, let user input manually
  };

  // Save broadcast address to settings
  const saveBroadcastAddress = async (address: string) => {
    try {
      const settings = await StorageService.getSettings();
      await StorageService.saveSettings({
        ...settings,
        broadcastAddress: address,
      });
    } catch (error) {
      console.error('Error saving broadcast address:', error);
    }
  };

  // Handle manual broadcast address input
  const handleManualBroadcastAddress = async (address: string) => {
    if (address.startsWith('ccx7') && address.length === 98) {
      setBroadcastAddress(address);
      await saveBroadcastAddress(address);
      setIsBroadcastExpanded(false);
    } else {
      Alert.alert('Invalid Address', 'Address must start with "ccx7" and be 98 characters long.');
    }
  };

  // Reset broadcast address to wallet address
  const resetBroadcastAddress = async () => {
    if (wallet) {
      const walletAddress = wallet.getPublicAddress();
      setBroadcastAddress(walletAddress);
      await saveBroadcastAddress(walletAddress);
    }
  };

  // Expandable sections state
  const [showRecoverySeed, setShowRecoverySeed] = useState(false);
  const [showExportQR, setShowExportQR] = useState(false);
  const [showRescanOptions, setShowRescanOptions] = useState(false);
  const [recoverySeed, setRecoverySeed] = useState('');
  const [exportQRData, setExportQRData] = useState('');

  // Calculate QR code size based on screen width
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 16; // 8px padding on each side of the card
  const expandablePadding = 16; // 8px padding on each side of expandable section
  const maxQRWidth = (screenWidth - cardPadding - expandablePadding) * 0.95;
  const qrSize = Math.min(maxQRWidth, 250); // Cap at 250px for readability

  const { theme, toggleTheme, setTheme, currentThemeId } = useTheme();
  const { wallet, refreshWallet } = useWallet();
  const navigation = useNavigation<NavigationProp>();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    checkBlockchainSyncVisibility();
    loadNodeInfo();
    loadRevokedKeys();
  }, [wallet]);

  const loadNodeInfo = async () => {
    try {
      const customNode = await WalletStorageManager.getCustomNode();

      if (customNode) {
        setCurrentNodeUrl(customNode);
        // Extract domain from URL for display (HTTPS only, no port)
        try {
          const url = new URL(customNode);
          setNodeDisplayName(`Custom: ${url.hostname}`);
        } catch {
          setNodeDisplayName('Custom Node');
        }
      } else {
        // Get the actual current session node URL
        const currentSessionNodeUrl = WalletService.getCurrentSessionNodeUrl();

        if (currentSessionNodeUrl) {
          setCurrentNodeUrl(currentSessionNodeUrl);
          try {
            const url = new URL(currentSessionNodeUrl);
            setNodeDisplayName(`Random: ${url.hostname}`);
          } catch {
            setNodeDisplayName('Random Node');
          }
        } else {
          // Fallback to default if no session node available
          const currentNode = config.nodeList[0];
          setCurrentNodeUrl(currentNode);
          try {
            const url = new URL(currentNode);
            setNodeDisplayName(`Default: ${url.hostname}`);
          } catch {
            setNodeDisplayName('Default Node');
          }
        }
      }
    } catch (error) {
      console.error('Error loading node info:', error);
      setCurrentNodeUrl(config.nodeList[0]);
      setNodeDisplayName('Default Node');
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await StorageService.getSettings();
      setBlockchainSync(settings.blockchainSync || false);
      setAutoShare(settings.autoShare || false);
      setCurrent2FADisplaySetting(settings.futureCodeDisplay || 'off');
      setBroadcastAddress(settings.broadcastAddress || '');
      // Enable biometric auth by default since we're using it
      setBiometricAuth(settings.biometricAuth !== false); // Default to true unless explicitly set to false
      // Load payment ID whitelist
      setPaymentIdWhiteList(settings.paymentIdWhiteList || []);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const checkBlockchainSyncVisibility = async () => {
    try {
      if (!wallet) {
        setShowBlockchainSyncToggle(false);
        return;
      }

      // Check visibility conditions:
      // 1. Wallet is not local (!wallet.isLocal())
      // 2. Wallet is synchronized with blockchain
      // 3. Wallet has sufficient balance (> 0.0111 CCX)
      const syncStatus = WalletService.getWalletSyncStatus();
      const isSynced = syncStatus.isWalletSynced;
      const hasBalance = wallet.amount > 0.0111;

      const shouldShow = !wallet.isLocal() && isSynced && hasBalance;
      setShowBlockchainSyncToggle(shouldShow);
    } catch (error) {
      console.error('Error checking blockchain sync visibility:', error);
      setShowBlockchainSyncToggle(false);
    }
  };

  const handleBlockchainSyncToggle = async (value: boolean) => {
    try {
      setBlockchainSync(value);
      await StorageService.saveSettings({
        ...(await StorageService.getSettings()),
        blockchainSync: value,
      });

      if (value) {
        // console.log('Blockchain Sync enabled: Setting local shared keys (hash=null && isLocal=true) to toBePush=true');
        // Set ONLY shared keys with hash=null && isLocal=true to toBePush=true
        const sharedKeys = await StorageService.getSharedKeys();
        let updated = false;

        for (const sharedKey of sharedKeys) {
          if (sharedKey.isLocal && !sharedKey.hash && !sharedKey.toBePush) {
            sharedKey.toBePush = true;
            updated = true;
            // console.log(`Blockchain Sync: Set toBePush=true for ${sharedKey.name} (hash=null, isLocal=true)`);
          }
        }

        if (updated) {
          await StorageService.saveSharedKeys(sharedKeys);
          //console.log('Blockchain Sync: Updated local shared keys to be pushed to blockchain');
        } else {
          getGlobalWorkletLogging().logging1string('Blockchain Sync: No local shared keys found to update');
        }
      } else {
        getGlobalWorkletLogging().logging1string('Blockchain Sync disabled: Individual save buttons will be shown');
        // When disabled, individual save buttons will be shown in ServiceCard
        // No need to modify existing shared keys
      }
    } catch (error) {
      console.error('Error toggling blockchain sync:', error);
      // Revert the toggle if there was an error
      setBlockchainSync(!value);
    }
  };

  const handleCustomNodeSave = async (newNodeUrl: string): Promise<boolean> => {
    try {
      let success: boolean;
      if (newNodeUrl.trim() === '') {
        // Empty string means reset to default (clear custom node)
        success = await WalletStorageManager.clearCustomNode();
      } else {
        // Save the custom node
        success = await WalletStorageManager.setCustomNode(newNodeUrl);
      }

      if (success) {
        // Re-initialize blockchain explorer to pick up custom node changes
        await WalletService.reinitializeBlockchainExplorer();

        // Reload node info to update display
        await loadNodeInfo();
        setShowCustomNodeModal(false);
      }
      return success;
    } catch (error) {
      console.error('Error saving custom node:', error);
      return false;
    }
  };

  const handleCustomNodeCancel = () => {
    setShowCustomNodeModal(false);
  };

  const handleShowSeed = () => {
    if (showRecoverySeed) {
      // Collapse the section
      setShowRecoverySeed(false);
      setRecoverySeed('');
    } else {
      // Expand and generate seed
      if (wallet?.keys?.priv?.spend) {
        try {
          // Derive seed from private key using Mnemonic.mn_encode()
          const mnemonic = Mnemonic.mn_encode(wallet.keys.priv.spend, 'english');
          setRecoverySeed(mnemonic);
          setShowRecoverySeed(true);
        } catch (error) {
          Alert.alert('Error', 'Failed to generate recovery seed from wallet keys.');
        }
      } else {
        Alert.alert('Error', 'No wallet keys available to generate seed.');
      }
    }
  };

  const handleExportWallet = () => {
    if (showExportQR) {
      // Collapse the section
      setShowExportQR(false);
      setExportQRData('');
    } else {
      // Expand and generate QR
      if (!wallet) {
        Alert.alert('Error', 'No wallet available for export');
        return;
      }

      if (wallet.isLocal()) {
        Alert.alert('Error', 'Cannot export local-only wallet. Please upgrade to blockchain wallet first.');
        return;
      }

      try {
        const qrData = ExportService.exportWalletAsQR(wallet);
        setExportQRData(qrData);
        setShowExportQR(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to export wallet QR code. Please try again.');
      }
    }
  };

  const handleCopySeed = async () => {
    try {
      await Clipboard.setStringAsync(recoverySeed);
      Alert.alert('Copied', 'Recovery seed copied to clipboard!');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy seed.');
    }
  };

  const handleCopyQRData = async () => {
    try {
      await Clipboard.setStringAsync(exportQRData);
      Alert.alert('Copied', 'QR code data copied to clipboard!');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy QR data.');
    }
  };

  const handleToggleClearDataOptions = () => {
    setShowClearDataOptions(!showClearDataOptions);
  };

  const handleToggleCleanLocalStorageOptions = () => {
    setShowCleanLocalStorageOptions(!showCleanLocalStorageOptions);
  };

  const loadRevokedKeys = async () => {
    try {
      const sharedKeys = await StorageService.getSharedKeys();
      const revoked = sharedKeys.filter((key) => key.timeStampSharedKeyRevoke > 0);
      setRevokedKeys(revoked);
    } catch (error) {
      console.error('Error loading revoked keys:', error);
    }
  };

  const handleResuscitateKey = async (keyId: string) => {
    try {
      const sharedKeys = await StorageService.getSharedKeys();
      const keyIndex = sharedKeys.findIndex((key) => key.hash === keyId);

      if (keyIndex !== -1) {
        sharedKeys[keyIndex].timeStampSharedKeyRevoke = 0;
        sharedKeys[keyIndex].isLocal = true;
        sharedKeys[keyIndex].hash = '';
        // Set toBePush based on blockchain sync toggle position
        sharedKeys[keyIndex].toBePush = blockchainSync;

        await StorageService.saveSharedKeys(sharedKeys);
        await loadRevokedKeys(); // Refresh the list

        // Trigger HomeScreen refresh to show resuscitated key
        WalletService.triggerSharedKeysRefresh();

        Alert.alert('Success', 'Shared key resuscitated successfully');
      }
    } catch (error) {
      console.error('Error resuscitating key:', error);
      Alert.alert('Error', 'Failed to resuscitate shared key');
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    Alert.alert('Delete Shared Key', 'Are you sure you want to permanently delete this shared key?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const sharedKeys = await StorageService.getSharedKeys();
            const filteredKeys = sharedKeys.filter((key) => key.hash !== keyId);

            await StorageService.saveSharedKeys(filteredKeys);
            await loadRevokedKeys(); // Refresh the list

            Alert.alert('Success', 'Shared key deleted successfully');
          } catch (error) {
            console.error('Error deleting key:', error);
            Alert.alert('Error', 'Failed to delete shared key');
          }
        },
      },
    ]);
  };

  const handleResuscitateAll = () => {
    Alert.alert('Resuscitate All', 'Are you sure you want to resuscitate all revoked shared keys?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resuscitate All',
        onPress: async () => {
          try {
            const sharedKeys = await StorageService.getSharedKeys();

            sharedKeys.forEach((key) => {
              if (key.timeStampSharedKeyRevoke > 0) {
                key.timeStampSharedKeyRevoke = 0;
                key.isLocal = true;
                key.hash = '';
                // Set toBePush based on blockchain sync toggle position
                key.toBePush = blockchainSync;
              }
            });

            await StorageService.saveSharedKeys(sharedKeys);
            await loadRevokedKeys(); // Refresh the list

            // Trigger HomeScreen refresh to show resuscitated keys
            WalletService.triggerSharedKeysRefresh();

            Alert.alert('Success', 'All revoked keys resuscitated successfully');
          } catch (error) {
            console.error('Error resuscitating all keys:', error);
            Alert.alert('Error', 'Failed to resuscitate all keys');
          }
        },
      },
    ]);
  };

  const handleDeleteAll = () => {
    Alert.alert('Delete All', 'Are you sure you want to permanently delete all revoked shared keys?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          try {
            const sharedKeys = await StorageService.getSharedKeys();
            const filteredKeys = sharedKeys.filter((key) => key.timeStampSharedKeyRevoke <= 0);

            await StorageService.saveSharedKeys(filteredKeys);
            await loadRevokedKeys(); // Refresh the list

            Alert.alert('Success', 'All revoked keys deleted successfully');
          } catch (error) {
            console.error('Error deleting all keys:', error);
            Alert.alert('Error', 'Failed to delete all keys');
          }
        },
      },
    ]);
  };

  const handleToggleRescanOptions = () => {
    setShowRescanOptions(!showRescanOptions);
  };

  const handleRescanFromCreationHeight = async () => {
    if (!wallet) {
      Alert.alert('Error', 'No wallet available for rescan');
      return;
    }

    // Use custom height if set, otherwise fall back to creation height
    const rescanHeight = customRescanHeight ?? wallet.creationHeight;
    const isCustomHeight = customRescanHeight !== null && customRescanHeight !== wallet.creationHeight;
    Alert.alert(
      isCustomHeight ? 'Rescan from Custom Height' : 'Rescan from Creation Height',
      `This will clear all transactions and rescan from block ${rescanHeight.toLocaleString()}. This may take some time.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              getGlobalWorkletLogging().logging1string1number('RESCAN: Starting rescan from height:', rescanHeight);

              // Clear all transactions, deposits, and withdrawals
              wallet.clearTransactions();

              // Set lastHeight to the specified rescan height
              wallet.lastHeight = rescanHeight;

              // Save the wallet with cleared data
              await WalletService.saveWallet('rescan from creation height');

              // Trigger wallet refresh to update UI
              refreshWallet();

              // Signal wallet update to trigger watchdog rescan
              await WalletService.signalWalletUpdate();

              Alert.alert('Success', `Rescan initiated from block ${rescanHeight.toLocaleString()}. Synchronization will restart.`);
              setShowRescanOptions(false);
              setIsEditingHeight(false);
              setCustomHeightInput('');
            } catch (error) {
              console.error('Error during rescan:', error);
              Alert.alert('Error', 'Failed to initiate rescan. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRescanFromZero = async () => {
    if (!wallet) {
      Alert.alert('Error', 'No wallet available for rescan');
      return;
    }

    Alert.alert(
      'Rescan from Block 0',
      'This will clear all transactions and rescan from the very beginning of the blockchain. This will take a very long time.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              getGlobalWorkletLogging().logging1string('RESCAN: Starting rescan from block 0');

              // Clear all transactions, deposits, and withdrawals
              wallet.clearTransactions();

              // Set lastHeight to 0
              wallet.lastHeight = 0;

              // Save the wallet with cleared data
              await WalletService.saveWallet('rescan from block 0');

              // Trigger wallet refresh to update UI
              refreshWallet();

              // Signal wallet update to trigger watchdog rescan
              await WalletService.signalWalletUpdate();

              Alert.alert('Success', 'Rescan initiated from block 0. Synchronization will restart from the beginning.');
              setShowRescanOptions(false);
            } catch (error) {
              console.error('Error during rescan from zero:', error);
              Alert.alert('Error', 'Failed to initiate rescan. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleClearWalletData = async () => {
    Alert.alert(
      'Clear Wallet Data',
      'You are about to erase your wallet data and go back to local wallet mode (no blockchain sync). Your local 2FA keys will remain.',
      [
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear wallet data from storage and cache
              await WalletService.clearWalletAndCache();

              // Reset upgrade prompt flags so new local wallet can show prompts
              await WalletService.resetUpgradeFlags();

              // Clear the wallet context state to force reinitialization
              await refreshWallet();

              // Navigate to HomeScreen (will show wallet creation/import options)
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            } catch (error) {
              console.error('Error in handleClearWalletData:', error);
              Alert.alert('Error', 'Failed to clear wallet data. Please try again.', [{ text: 'OK' }]);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleClearData = async () => {
    Alert.alert('Clear All Data', 'You are about to erase ALL DATA. Only what was saved on Blockchain can be retrieved.', [
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: async () => {
          try {
            // console.log('=== BEFORE CLEAR ALL ===');
            await StorageService.debugStorage();

            await WalletService.forceClearAll();

            // Reset upgrade prompt flags so new local wallet can show prompts
            await WalletService.resetUpgradeFlags();

            // console.log('=== AFTER CLEAR ALL ===');
            await StorageService.debugStorage();

            // Clear the wallet context state to force reinitialization
            await refreshWallet();

            // Navigate to HomeScreen
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });

            Alert.alert('Success', 'All data cleared successfully. The app will restart.');
          } catch (error) {
            console.error('Error in handleClearData:', error);
            Alert.alert('Error', 'Failed to clear data. Please try again.', [{ text: 'OK' }]);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePasswordChange = async (oldPassword: string, newPassword: string) => {
    try {
      // Safety check: password change should only be available when biometric is disabled
      if (biometricAuth) {
        Alert.alert('Error', 'Password change is only available when biometric authentication is disabled');
        return;
      }

      // 1. Get the current wallet with the old password (this also verifies the password)
      const currentWallet = await WalletStorageManager.getDecryptedWalletWithPassword(oldPassword);
      if (!currentWallet) {
        Alert.alert('Error', 'Current password is incorrect or could not retrieve wallet data');
        return;
      }

      // 2. Re-encrypt the wallet with the new password
      await WalletStorageManager.saveEncryptedWallet(currentWallet, newPassword);

      // Note: No need to update biometric salt since we're in password mode
      // Biometric salt is only relevant when biometric authentication is enabled

      Alert.alert('Success', 'Password changed successfully');
      setShowPasswordChangeAlert(false);
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to change password. Please try again.');
    }
  };

  const handleEnableBiometric = async (password: string) => {
    try {
      getGlobalWorkletLogging().logging1string1number(
        'BIOMETRIC ENABLE: Attempting to enable biometric with password length:',
        password.length
      );

      // 1. Get wallet from WalletService (already in memory, no password prompt)
      const currentWallet = WalletService.getCachedWallet();
      if (!currentWallet) {
        console.error('BIOMETRIC ENABLE: No wallet available in memory');
        Alert.alert('Error', 'No wallet available');
        return;
      }

      // 2. Verify the password against stored hash (no wallet loading needed)
      const storedDerivedKey = await WalletStorageManager.verifyPasswordAndGetKey(password);
      if (!storedDerivedKey) {
        console.error('BIOMETRIC ENABLE: Password verification failed');
        Alert.alert('Error', 'Password is incorrect');
        return;
      }

      getGlobalWorkletLogging().logging1string('BIOMETRIC ENABLE: Password verification successful, wallet decrypted');

      // 2. Generate and store biometric salt with the verified password
      await WalletStorageManager.generateAndStoreBiometricSalt(password);

      // 3. Re-encrypt the wallet with the derived biometric key
      const biometricKey = await WalletStorageManager.deriveBiometricKey();
      if (!biometricKey) {
        Alert.alert('Error', 'Failed to generate biometric key');
        return;
      }

      // Re-encrypt wallet with biometric key directly (bypass mode check)
      const encryptedWallet = WalletRepository.save(currentWallet, biometricKey);
      await WalletStorageManager.saveEncryptedWalletData(encryptedWallet);

      // 4. Enable biometric authentication in settings
      setBiometricAuth(true);
      await StorageService.saveSettings({
        ...(await StorageService.getSettings()),
        biometricAuth: true,
      });

      // Close the modal first, then show success alert
      setShowUnlockWalletAlert(false);

      // Show success alert after modal is closed
      setTimeout(() => {
        Alert.alert('Success', 'Biometric authentication enabled successfully');
      }, 200);
    } catch (error) {
      console.error('Error enabling biometric:', error);
      Alert.alert('Error', 'Failed to enable biometric authentication. Please try again.');
    }
  };

  const handleDisableBiometric = async (newPassword: string) => {
    try {
      // 1. Get the current wallet from WalletService (already decrypted in memory)
      const currentWallet = WalletService.getCachedWallet();

      if (!currentWallet) {
        Alert.alert('Error', 'No wallet available. Please restart the app and try again.');
        return;
      }

      // 2. Re-encrypt the wallet with the NEW user password using persistent key approach
      await WalletStorageManager.saveEncryptedWalletWithPersistentKey(currentWallet, newPassword);

      // 3. Store the password key for quiet saves (like after authentication)
      const passwordKey = await WalletStorageManager.derivePasswordKey(newPassword);
      WalletStorageManager.setCurrentSessionPasswordKey(passwordKey);

      // 4. Disable biometric authentication in settings
      setBiometricAuth(false);
      await StorageService.saveSettings({
        ...(await StorageService.getSettings()),
        biometricAuth: false,
      });

      // Close the modal first, then show success alert
      setShowPasswordCreationAlert(false);

      // Show success alert after modal is closed
      setTimeout(() => {
        Alert.alert('Success', 'Biometric authentication disabled. You will now use password authentication.');
      }, 200);
    } catch (error) {
      console.error('Error disabling biometric:', error);
      Alert.alert('Error', 'Failed to disable biometric authentication. Please try again.');
    }
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    rightElement,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity className="flex-row items-center justify-between p-4" onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View className="flex-row items-center flex-1">
        <Ionicons name={icon as any} size={24} color={theme.colors.text} />
        <View className="ml-3 flex-1">
          <Text className="text-base font-medium" style={{ color: theme.colors.text }}>
            {title}
          </Text>
          {subtitle && (
            <Text className="text-sm mt-0.5" style={{ color: theme.colors.textSecondary }}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {rightElement || (onPress && <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />)}
    </TouchableOpacity>
  );

  // Payment ID Whitelist Management Functions
  const handleGeneratePaymentId = async () => {
    try {
      const generator = new CnUtils.PaymentIdGenerator();
      const newPaymentId = generator.generateRandomPaymentId();

      const updatedList = [...paymentIdWhiteList, newPaymentId];
      setPaymentIdWhiteList(updatedList);

      // Save to settings
      const settings = await StorageService.getSettings();
      await StorageService.saveSettings({
        ...settings,
        paymentIdWhiteList: updatedList,
      });

      Alert.alert('Success', 'New Payment ID generated and added to whitelist');
    } catch (error) {
      console.error('Error generating payment ID:', error);
      Alert.alert('Error', 'Failed to generate payment ID');
    }
  };

  const handleCopyPaymentId = async (paymentId: string) => {
    try {
      await Clipboard.setStringAsync(paymentId);
      Alert.alert('Copied', 'Payment ID copied to clipboard!');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy payment ID');
    }
  };

  const handleDeletePaymentId = async (paymentIdToDelete: string) => {
    try {
      const updatedList = paymentIdWhiteList.filter((id) => id !== paymentIdToDelete);
      setPaymentIdWhiteList(updatedList);

      // Save to settings
      const settings = await StorageService.getSettings();
      await StorageService.saveSettings({
        ...settings,
        paymentIdWhiteList: updatedList,
      });

      Alert.alert('Deleted', 'Payment ID removed from whitelist');
    } catch (error) {
      console.error('Error deleting payment ID:', error);
      Alert.alert('Error', 'Failed to delete payment ID');
    }
  };

  const handleValidatePaymentId = (paymentId: string): boolean => {
    return CnUtils.validatePaymentId(paymentId);
  };

  const handleAddManualPaymentId = async () => {
    const trimmedPaymentId = manualPaymentId.trim();

    if (!trimmedPaymentId) {
      Alert.alert('Error', 'Please enter a payment ID');
      return;
    }

    if (!handleValidatePaymentId(trimmedPaymentId)) {
      Alert.alert('Invalid Payment ID', 'Payment ID must be exactly 64 hexadecimal characters (0-9, a-f, A-F)');
      return;
    }

    if (paymentIdWhiteList.includes(trimmedPaymentId)) {
      Alert.alert('Duplicate', 'This payment ID is already in the whitelist');
      return;
    }

    try {
      const updatedList = [...paymentIdWhiteList, trimmedPaymentId];
      setPaymentIdWhiteList(updatedList);

      // Save to settings
      const settings = await StorageService.getSettings();
      await StorageService.saveSettings({
        ...settings,
        paymentIdWhiteList: updatedList,
      });

      setManualPaymentId(''); // Clear input
      Alert.alert('Success', 'Payment ID added to whitelist');
    } catch (error) {
      console.error('Error adding manual payment ID:', error);
      Alert.alert('Error', 'Failed to add payment ID');
    }
  };

  return (
    <GestureNavigator>
      <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
        <Header title="Settings" />
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Appearance Settings */}
          <ExpSectionToggle
            sectionTitle="Appearance"
            title="Theme"
            subtitle="Toggle dark/light theme"
            icon="color-palette-outline"
            isExpanded={isThemeExpanded}
            onToggle={() => setIsThemeExpanded(!isThemeExpanded)}
            onToggleSwitch={(value) => {
              // Only toggle between light and dark for the switch
              const targetTheme = value ? 'dark' : 'light';
              setTheme(targetTheme);
            }}
            onOptionSelect={handleThemeSelect}
            options={themeOptions}
            selectedOptionId={getCurrentThemeId()}
            leftOptionId="light"
            rightOptionId="dark"
          />

          {/* 2FA Display Settings */}
          <ExpSectionToggle
            sectionTitle="2FA Display"
            title="Future Display"
            subtitle="Show next 2FA code alongside current"
            icon="eye-outline"
            isExpanded={is2FADisplayExpanded}
            onToggle={() => setIs2FADisplayExpanded(!is2FADisplayExpanded)}
            onToggleSwitch={async (value) => {
              // Toggle between OFF and ON for the switch
              // If value is true, set to 'on', if false, set to 'off'
              const targetSetting = value ? 'on' : 'off';
              await handle2FADisplaySelect(targetSetting);
            }}
            onOptionSelect={handle2FADisplaySelect}
            options={futureDisplayOptions}
            selectedOptionId={current2FADisplaySetting}
            leftOptionId="off"
            rightOptionId="on"
          />

          {/* Wallet Management */}
          <View className="mb-6">
            <Text className="text-base font-semibold mb-2 ml-1" style={{ color: theme.colors.text }}>
              Wallet Management
            </Text>
            <View className="rounded-2xl shadow-lg" style={{ backgroundColor: theme.colors.card }}>
              {/* Only show Rescan Wallet for blockchain wallets (not local-only) */}
              {wallet && !wallet.isLocal() && (
                <>
                  <SettingItem
                    icon="refresh-outline"
                    title="Rescan Wallet"
                    subtitle={showRescanOptions ? 'Hide rescan options' : 'Rescan blockchain for transactions'}
                    onPress={handleToggleRescanOptions}
                    rightElement={
                      <Ionicons name={showRescanOptions ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
                    }
                  />

                  {/* Rescan Options Expandable Section */}
                  {showRescanOptions && (
                    <View
                      className="p-4 mt-2 rounded-xl border"
                      style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
                    >
                      <TouchableOpacity
                        className="flex-row items-center p-4 rounded-lg mb-2 border"
                        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
                        onPress={handleRescanFromCreationHeight}
                      >
                        <Ionicons name="play-outline" size={20} color={theme.colors.primary} />
                        <View className="ml-3 flex-1">
                          <Text className="text-base font-medium" style={{ color: theme.colors.text }}>
                            Rescan from Creation Height
                          </Text>
                          {isEditingHeight ? (
                            <View className="flex-row items-center mt-1">
                              <TextInput
                                className="text-sm border rounded px-2 py-1 flex-1 mr-2"
                                style={{
                                  borderColor: theme.colors.primary,
                                  color: theme.colors.text,
                                  backgroundColor: theme.colors.background,
                                }}
                                placeholder={wallet ? wallet.creationHeight.toLocaleString() : '0'}
                                value={customHeightInput}
                                onChangeText={setCustomHeightInput}
                                keyboardType="numeric"
                                autoFocus
                                onSubmitEditing={() => {
                                  // Parse and save the custom height
                                  const height = parseInt(customHeightInput.trim(), 10);
                                  if (!isNaN(height) && height >= 0) {
                                    setCustomRescanHeight(height);
                                  }
                                  setIsEditingHeight(false);
                                }}
                                onBlur={() => {
                                  // Parse and save the custom height when user leaves the field
                                  const height = parseInt(customHeightInput.trim(), 10);
                                  if (!isNaN(height) && height >= 0) {
                                    setCustomRescanHeight(height);
                                  }
                                  setIsEditingHeight(false);
                                }}
                              />
                              <TouchableOpacity
                                onPress={() => {
                                  setIsEditingHeight(false);
                                  setCustomHeightInput('');
                                }}
                              >
                                <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              onPress={() => {
                                // Pre-fill the input with current custom height or creation height
                                if (customRescanHeight) {
                                  setCustomHeightInput(customRescanHeight.toString());
                                } else if (wallet) {
                                  setCustomHeightInput(wallet.creationHeight.toString());
                                }
                                setIsEditingHeight(true);
                              }}
                            >
                              <Text className="text-sm mt-0.5" style={{ color: theme.colors.primary }}>
                                {customRescanHeight
                                  ? `Block ${customRescanHeight.toLocaleString()}`
                                  : wallet
                                    ? `Block ${wallet.creationHeight.toLocaleString()}`
                                    : 'Block 0'}{' '}
                                (tap to edit)
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="flex-row items-center p-4 rounded-lg border"
                        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
                        onPress={handleRescanFromZero}
                      >
                        <Ionicons name="refresh-outline" size={20} color={theme.colors.warning} />
                        <View className="ml-3 flex-1">
                          <Text className="text-base font-medium" style={{ color: theme.colors.text }}>
                            Rescan from Block 0
                          </Text>
                          <Text className="text-sm mt-0.5" style={{ color: theme.colors.textSecondary }}>
                            Complete blockchain rescan (very slow)
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <SettingItem
                icon="key-outline"
                title="Show Recovery Seed"
                subtitle={showRecoverySeed ? 'Hide recovery phrase' : 'View your 25-word recovery phrase'}
                onPress={handleShowSeed}
                rightElement={
                  <Ionicons name={showRecoverySeed ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
                }
              />

              {/* Recovery Seed Expandable Section */}
              {showRecoverySeed && (
                <View
                  className="p-4 mt-2 rounded-xl border"
                  style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
                >
                  <Text
                    className="text-sm font-mono p-3 rounded-lg mb-3 leading-5"
                    style={{ color: theme.colors.text, backgroundColor: theme.colors.surface }}
                  >
                    {recoverySeed}
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center justify-center rounded-lg p-3"
                    style={{ backgroundColor: theme.colors.primaryLight }}
                    onPress={handleCopySeed}
                  >
                    <Ionicons name="copy-outline" size={16} color={theme.colors.primary} />
                    <Text className="text-sm font-semibold ml-2" style={{ color: theme.colors.primary }}>
                      Copy Seed
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <SettingItem
                icon="download-outline"
                title="Export Wallet"
                subtitle={showExportQR ? 'Hide QR code' : 'Backup your wallet'}
                onPress={handleExportWallet}
                rightElement={<Ionicons name={showExportQR ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />}
              />

              {/* Export QR Expandable Section */}
              {showExportQR && (
                <View
                  className="p-4 mt-2 rounded-xl border"
                  style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
                >
                  <View className="items-center p-5 rounded-xl mb-3 shadow-md" style={{ backgroundColor: 'white' }}>
                    <QRCode value={exportQRData} size={qrSize} backgroundColor="white" color="black" />
                  </View>
                  <Text className="text-sm text-center mb-3 italic" style={{ color: theme.colors.textSecondary }}>
                    Scan this QR code to import the wallet
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center justify-center rounded-lg p-3"
                    style={{ backgroundColor: theme.colors.primaryLight }}
                    onPress={handleCopyQRData}
                  >
                    <Ionicons name="copy-outline" size={16} color={theme.colors.primary} />
                    <Text className="text-sm font-semibold ml-2" style={{ color: theme.colors.primary }}>
                      Copy QR Data
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Blockchain Settings */}
          <View className="mb-6">
            <Text className="text-base font-semibold mb-2 ml-1" style={{ color: theme.colors.text }}>
              Blockchain
            </Text>
            <View className="rounded-2xl shadow-lg" style={{ backgroundColor: theme.colors.card }}>
              {/* Remote Node Configuration */}
              <SettingItem
                icon="server-outline"
                title="Remote Node"
                subtitle={nodeDisplayName}
                onPress={() => setShowCustomNodeModal(true)}
                rightElement={<Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />}
              />

              {showBlockchainSyncToggle && (
                <SettingItem
                  icon="cloud-outline"
                  title="Blockchain Sync"
                  subtitle="Backup automatically all shared keys to blockchain"
                  rightElement={
                    <Switch
                      value={blockchainSync}
                      onValueChange={handleBlockchainSyncToggle}
                      trackColor={{
                        false: theme.colors.border,
                        true: theme.colors.primary,
                      }}
                      thumbColor={theme.colors.background}
                      ios_backgroundColor={theme.colors.border}
                    />
                  }
                />
              )}

              {showBlockchainSyncToggle && (
                <>
                  <SettingItem
                    icon="radio-outline"
                    title="Broadcast Code"
                    subtitle={
                      broadcastAddress ? `Send to: ${broadcastAddress.substring(0, 10)}...` : 'Send 2FA codes via auto-destruct message'
                    }
                    onPress={() => setIsBroadcastExpanded(!isBroadcastExpanded)}
                    rightElement={
                      <Ionicons name={isBroadcastExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
                    }
                  />

                  {/* Broadcast Options Expandable Section */}
                  {isBroadcastExpanded && (
                    <View
                      className="p-4 mt-2 rounded-xl border"
                      style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
                    >
                      <Text className="text-sm font-medium mb-3 font-poppins-medium" style={{ color: theme.colors.textSecondary }}>
                        Choose broadcast destination:
                      </Text>

                      {/* Current Address Display */}
                      <View className="mb-3 p-3 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
                        <Text className="text-sm font-medium mb-1 font-poppins-medium" style={{ color: theme.colors.text }}>
                          Current Destination:
                        </Text>
                        <Text className="text-xs font-mono" style={{ color: theme.colors.textSecondary }}>
                          {broadcastAddress || wallet?.getPublicAddress() || 'Wallet Address'}
                        </Text>
                      </View>

                      {/* QR Scanner Option */}
                      <TouchableOpacity
                        className="flex-row items-center p-3 rounded-lg mb-2 border"
                        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
                        onPress={() => setShowBroadcastQRScanner(true)}
                      >
                        <Ionicons name="qr-code-outline" size={20} color={theme.colors.primary} />
                        <View className="ml-3 flex-1">
                          <Text className="text-base font-medium" style={{ color: theme.colors.text }}>
                            Scan QR Code
                          </Text>
                          <Text className="text-sm mt-0.5" style={{ color: theme.colors.textSecondary }}>
                            Scan a CCX address QR code
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Manual Input Option */}
                      <TouchableOpacity
                        className="flex-row items-center p-3 rounded-lg mb-2 border"
                        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
                        onPress={() => {
                          Alert.prompt(
                            'Enter CCX Address',
                            'Enter the CCX address to broadcast to:',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Save',
                                onPress: (text) => {
                                  if (text) {
                                    handleManualBroadcastAddress(text.trim());
                                  }
                                },
                              },
                            ],
                            'plain-text',
                            broadcastAddress || wallet?.getPublicAddress() || '',
                            'default'
                          );
                        }}
                      >
                        <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                        <View className="ml-3 flex-1">
                          <Text className="text-base font-medium" style={{ color: theme.colors.text }}>
                            Enter Manually
                          </Text>
                          <Text className="text-sm mt-0.5" style={{ color: theme.colors.textSecondary }}>
                            Type CCX address manually
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Reset to Wallet Address */}
                      <TouchableOpacity
                        className="flex-row items-center p-3 rounded-lg border"
                        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
                        onPress={resetBroadcastAddress}
                      >
                        <Ionicons name="refresh-outline" size={20} color={theme.colors.warning} />
                        <View className="ml-3 flex-1">
                          <Text className="text-base font-medium" style={{ color: theme.colors.text }}>
                            Reset to Wallet Address
                          </Text>
                          <Text className="text-sm mt-0.5" style={{ color: theme.colors.textSecondary }}>
                            Send to your own wallet address
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Trust Anchor (Payment ID Whitelist) */}
          {showBlockchainSyncToggle && (
            <View className="mb-6">
              <Text className="text-base font-semibold mb-2 ml-1" style={{ color: theme.colors.text }}>
                Trust Anchor
              </Text>
              <View className="rounded-2xl shadow-lg" style={{ backgroundColor: theme.colors.card }}>
                <SettingItem
                  icon="shield-checkmark-outline"
                  title="Payment ID Whitelist"
                  subtitle={`${paymentIdWhiteList.length} trusted payment IDs`}
                  onPress={() => setIsTrustAnchorExpanded(!isTrustAnchorExpanded)}
                  rightElement={
                    <Ionicons name={isTrustAnchorExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
                  }
                />

                {/* Trust Anchor Expandable Section */}
                {isTrustAnchorExpanded && (
                  <View
                    className="p-4 mt-2 rounded-xl border"
                    style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
                  >
                    <Text className="text-sm font-medium mb-3 font-poppins-medium" style={{ color: theme.colors.textSecondary }}>
                      Whitelist of trusted payment IDs for smart messages
                    </Text>

                    {/* Generate Button */}
                    <TouchableOpacity
                      className="flex-row items-center justify-center p-3 mb-4 rounded-lg border-2 border-dashed"
                      style={{ borderColor: theme.colors.primary }}
                      onPress={handleGeneratePaymentId}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                      <Text className="ml-2 font-medium" style={{ color: theme.colors.primary }}>
                        Generate Payment ID
                      </Text>
                    </TouchableOpacity>

                    {/* Manual Payment ID Input */}
                    <View className="mb-4">
                      <Text className="text-sm font-medium mb-2 font-poppins-medium" style={{ color: theme.colors.textSecondary }}>
                        Or enter a payment ID manually:
                      </Text>
                      <View className="flex-row items-center">
                        <TextInput
                          className="flex-1 p-3 rounded-lg border mr-2 font-mono text-xs"
                          style={{
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border,
                            color: theme.colors.text,
                          }}
                          placeholder="Enter 64-character payment ID..."
                          placeholderTextColor={theme.colors.textSecondary}
                          value={manualPaymentId}
                          onChangeText={setManualPaymentId}
                          maxLength={64}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TouchableOpacity
                          className="px-4 py-3 rounded-lg"
                          style={{ backgroundColor: theme.colors.primary }}
                          onPress={handleAddManualPaymentId}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="checkmark" size={16} color={theme.colors.background} />
                        </TouchableOpacity>
                      </View>
                      {manualPaymentId.length > 0 && (
                        <Text
                          className="text-xs mt-1"
                          style={{
                            color: handleValidatePaymentId(manualPaymentId) ? theme.colors.success : theme.colors.error,
                          }}
                        >
                          {handleValidatePaymentId(manualPaymentId) ? 'Valid payment ID' : 'Invalid payment ID format'}
                        </Text>
                      )}
                    </View>

                    {/* Payment ID List */}
                    {paymentIdWhiteList.length > 0 ? (
                      <View>
                        {paymentIdWhiteList.map((paymentId, index) => (
                          <View
                            key={index}
                            className="flex-row items-center justify-between p-3 mb-2 rounded-lg"
                            style={{ backgroundColor: theme.colors.card }}
                          >
                            <TouchableOpacity className="flex-1" onPress={() => handleCopyPaymentId(paymentId)} activeOpacity={0.7}>
                              <Text className="text-xs font-mono" style={{ color: theme.colors.text }}>
                                {paymentId.substring(0, 16)}...{paymentId.substring(48)}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity className="p-2" onPress={() => handleDeletePaymentId(paymentId)} activeOpacity={0.7}>
                              <Ionicons name="trash-outline" size={16} color={theme.colors.warning} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text className="text-sm text-center py-4" style={{ color: theme.colors.textSecondary }}>
                        No payment IDs in whitelist
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Security Settings */}
          <View className="mb-6">
            <Text className="text-base font-semibold mb-2 ml-1" style={{ color: theme.colors.text }}>
              Security
            </Text>
            <View className="rounded-2xl shadow-lg" style={{ backgroundColor: theme.colors.card }}>
              <SettingItem
                icon="finger-print-outline"
                title="Biometric Authentication"
                subtitle="Use fingerprint or face ID"
                rightElement={
                  <Switch
                    value={biometricAuth}
                    onValueChange={async (value) => {
                      if (!value) {
                        // User is disabling biometric auth - show warning
                        Alert.alert(
                          'Disable Biometric Authentication',
                          'You will be asked to set a new password for your wallet.\n\nYou will use this password to access the app instead of biometric authentication.',
                          [
                            {
                              text: 'Cancel',
                              onPress: () => {
                                // Don't change the toggle, keep it enabled
                                setBiometricAuth(true);
                              },
                              style: 'cancel',
                            },
                            {
                              text: 'Confirm',
                              onPress: async () => {
                                // Show password input alert for disabling biometric
                                setBiometricAction('disable');
                                setShowPasswordCreationAlert(true);
                              },
                            },
                          ]
                        );
                      } else {
                        // User is enabling biometric auth - request password to update biometric salt
                        Alert.alert('Enable Biometric Authentication', 'Enter your wallet password to enable biometric authentication.', [
                          {
                            text: 'Cancel',
                            onPress: () => {
                              // Don't change the toggle, keep it disabled
                              setBiometricAuth(false);
                            },
                            style: 'cancel',
                          },
                          {
                            text: 'Enable',
                            onPress: async () => {
                              // Show password input alert
                              setBiometricAction('enable');
                              setShowUnlockWalletAlert(true);
                            },
                          },
                        ]);
                      }
                    }}
                    trackColor={{
                      false: theme.colors.border,
                      true: theme.colors.primary,
                    }}
                    thumbColor={theme.colors.background}
                    ios_backgroundColor={theme.colors.border}
                  />
                }
              />

              {/* Change Password option - only visible when biometric is disabled */}
              {!biometricAuth && (
                <SettingItem
                  icon="key-outline"
                  title="Change Password"
                  subtitle="Update your wallet password"
                  onPress={() => setShowPasswordChangeAlert(true)}
                />
              )}
            </View>
          </View>

          {/* Storage */}
          <ExpandableSection
            title="Storage"
            subtitle="Clear or delete data"
            icon="trash-outline"
            isExpanded={showClearDataOptions}
            onToggle={handleToggleClearDataOptions}
          >
            {/* Clean LocalStorage Subsection */}
            <ExpandableSection
              title="Clean"
              subtitle="Manage revoked shared keys"
              icon="brush-outline"
              isExpanded={showCleanLocalStorageOptions}
              onToggle={handleToggleCleanLocalStorageOptions}
            >
              {revokedKeys.length > 0 ? (
                <View>
                  {revokedKeys.map((key) => (
                    <View key={key.hash} className="flex-row items-center justify-between p-3 border-b border-gray-200">
                      {/* Resuscitate icon on the left */}
                      <TouchableOpacity
                        onPress={() => handleResuscitateKey(key.hash)}
                        className="p-2 rounded-full mr-3"
                        style={{ backgroundColor: theme.colors.primary + '20' }}
                      >
                        <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
                      </TouchableOpacity>

                      {/* Key info in the middle */}
                      <View className="flex-1">
                        <Text className="text-base font-medium" style={{ color: theme.colors.text }}>
                          {key.name.length > 10 ? key.name.substring(0, 10) + '...' : key.name}
                        </Text>
                        <Text className="text-sm" style={{ color: theme.colors.textSecondary }}>
                          {key.issuer}
                        </Text>
                      </View>

                      {/* Delete icon on the right */}
                      <TouchableOpacity
                        onPress={() => handleDeleteKey(key.hash)}
                        className="p-2 rounded-full"
                        style={{ backgroundColor: theme.colors.error + '20' }}
                      >
                        <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View className="flex-row justify-between p-3">
                    <TouchableOpacity onPress={handleResuscitateAll} className="flex-1 bg-green-500 p-3 rounded-lg mr-2">
                      <Text className="text-white text-center font-medium">Resuscitate All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDeleteAll} className="flex-1 bg-red-500 p-3 rounded-lg ml-2">
                      <Text className="text-white text-center font-medium">Delete All</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View className="p-4">
                  <Text className="text-center" style={{ color: theme.colors.textSecondary }}>
                    No revoked shared keys found
                  </Text>
                </View>
              )}
            </ExpandableSection>

            <SettingItem
              icon="wallet-outline"
              title="Clear Wallet Data"
              subtitle="Clear wallet data and recreate empty local-only wallet"
              onPress={handleClearWalletData}
              rightElement={<Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />}
            />
            <SettingItem
              icon="trash-outline"
              title="Clear All Data"
              subtitle="Remove all services, wallet data, and settings"
              onPress={handleClearData}
              rightElement={<Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />}
            />
          </ExpandableSection>

          {/* About */}
          <View className="mb-6">
            <Text className="text-base font-semibold mb-2 ml-1" style={{ color: theme.colors.text }}>
              About
            </Text>
            <View className="rounded-2xl shadow-lg" style={{ backgroundColor: theme.colors.card }}>
              <SettingItem icon="information-circle-outline" title="Version" subtitle={packageJson.version} />
              <SettingItem icon="document-text-outline" title="Terms and Conditions" onPress={() => setShowTermsModal(true)} />
            </View>
          </View>
        </ScrollView>
      </View>

      <PasswordChangeAlert
        visible={showPasswordChangeAlert}
        title="Change Password"
        message="Enter your current password and choose a new secure password."
        onCancel={() => setShowPasswordChangeAlert(false)}
        onConfirm={handlePasswordChange}
      />

      <UnlockWalletAlert
        visible={showUnlockWalletAlert}
        title="Enable Biometric Authentication"
        message="Enter your current wallet password to enable biometric authentication."
        onCancel={() => setShowUnlockWalletAlert(false)}
        onConfirm={handleEnableBiometric}
      />

      <PasswordCreationAlert
        visible={showPasswordCreationAlert}
        title="Set New Password"
        message="Enter a new password for your wallet. This will replace biometric authentication."
        onCancel={() => setShowPasswordCreationAlert(false)}
        onConfirm={handleDisableBiometric}
      />

      {/* Custom Node Modal */}
      <CustomNodeModal
        visible={showCustomNodeModal}
        currentNode={currentNodeUrl}
        onCancel={handleCustomNodeCancel}
        onSave={handleCustomNodeSave}
      />

      {/* Broadcast QR Scanner Modal */}
      <QRScannerModal visible={showBroadcastQRScanner} onClose={handleBroadcastQRClose} onScan={handleBroadcastQRScan} />

      {/* Terms and Conditions Modal */}
      <TermsModal visible={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </GestureNavigator>
  );
}
