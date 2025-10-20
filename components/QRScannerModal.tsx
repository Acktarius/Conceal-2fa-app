import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export default function QRScannerModal({ visible, onClose, onScan }: QRScannerModalProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (!scanned && cameraActive) {
      setScanned(true);
      setCameraActive(false); // Deactivate camera immediately after scan
      onScan(data);
    }
  };

  const handleClose = () => {
    setScanned(false);
    setCameraActive(false); // Ensure camera is deactivated
    onClose();
  };

  // Control camera activation based on modal visibility
  useEffect(() => {
    if (visible && hasPermission === true) {
      setCameraActive(true);
      setScanned(false);
    } else {
      setCameraActive(false);
    }
  }, [visible, hasPermission]);

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide" transparent={true} statusBarTranslucent={true}>
        <View style={[styles.container, styles.centered]}>
          <Text>Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide" transparent={true} statusBarTranslucent={true}>
        <View style={[styles.container, styles.centered]}>
          <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Please allow camera access to scan QR codes for adding 2FA services.
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.cameraContainer}>
          {visible && (
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={cameraActive ? handleBarCodeScanned : undefined}
            />
          )}

          <View style={styles.overlay}>
            {/* Top overlay */}
            <View style={styles.topOverlay} />

            {/* Middle row with left overlay, scan area, and right overlay */}
            <View style={styles.middleRow}>
              <View style={styles.sideOverlay} />
              <View style={styles.scanArea}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View style={styles.sideOverlay} />
            </View>

            {/* Bottom overlay */}
            <View style={styles.bottomOverlay} />
          </View>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionText}>Position the QR code within the frame to scan</Text>
          {scanned && (
            <TouchableOpacity style={styles.scanAgainButton} onPress={() => setScanned(false)}>
              <Text style={styles.scanAgainText}>Tap to scan again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    zIndex: 9999,
    ...(Platform.OS === 'ios' && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    }),
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 32,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 120, // Start overlay below the header
    left: 0,
    right: 0,
    bottom: 0,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    marginTop: -125, // Half of scan area height to center it
  },
  middleRow: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 250,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -125, // Half of scan area height to center it
  },
  sideOverlay: {
    flex: 1,
    height: 250,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    marginBottom: -125, // Half of scan area height to center it
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
    borderRadius: 8,
  },
  topLeft: {
    top: -5,
    left: -5,
    borderTopWidth: 6,
    borderLeftWidth: 6,
  },
  topRight: {
    top: -5,
    right: -5,
    borderTopWidth: 6,
    borderRightWidth: 6,
  },
  bottomLeft: {
    bottom: -5,
    left: -5,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
  },
  bottomRight: {
    bottom: -5,
    right: -5,
    borderBottomWidth: 6,
    borderRightWidth: 6,
  },
  instructions: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  scanAgainButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  scanAgainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  closeButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
