# Conceal Authenticator

A React Native 2FA authenticator app that leverages the Conceal Network blockchain to securely backup your 2FA shared keys using a built-in lite wallet.

## Features

### 🔐 Flexible Backup Options
- **Your Choice**: Use as a local-only 2FA app, enable manual backup, or automatic  backup to the Conceal Network blockchain.   
- **ChaCha12 Stream Cipher**: All sensitive data is encrypted using the ChaCha12 stream cipher before blockchain storage  
- **Lite Wallet**: Built-in lightweight wallet for seamless blockchain interactions when backup is enabled  
- **Self-Custody**: You control your keys and data - no third-party servers

### 🎨 User Experience
- **Multiple Themes**: Choose from Light, Orange, Velvet, and Dark themes
- **Future Codes**: Preview upcoming TOTP codes to prepare for time-sensitive operations
- **Cross-Platform**: Available for iOS and Android

### 🛡️ Privacy & Security
- **Biometric Authentication**: Unlock with Face ID, Touch ID, or fingerprint
- **Local Encryption**: Secure storage using platform-native secure enclaves
- **No Central Server**: Direct peer-to-peer blockchain interaction

## Technology Stack

- **Frontend**: React Native, Expo
- **Blockchain**: Conceal Network (CryptoNote protocol)
- **Cryptography**: Native C++ modules (Nitro JSI) for high-performance crypto operations
- **Encryption**: ChaCha12, libsodium
- **Storage**: Expo SecureStore, AsyncStorage

## Getting Started

```bash
# Install dependencies
npm install

# Build for Android
./build-android.sh
cd android && ./gradlew assembleRelease

# Run on iOS
eas build -p ios --profile production
```

## License

BSD 3-Clause License

Copyright (c) 2025 Acktarius, Conceal Devs

---

**Note**: This is a self-custody solution. Always backup your recovery seed securely. Lost seeds cannot be recovered.
