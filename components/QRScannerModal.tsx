import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor, runAtTargetFps, type Frame } from 'react-native-vision-camera';
import { zxing } from 'vision-camera-zxing';
import { Worklets } from 'react-native-worklets-core';
import { useSharedValue } from 'react-native-reanimated';

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export default function QRScannerModal({ visible, onClose, onScan }: QRScannerModalProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [scanned, setScanned] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const device = useCameraDevice('back');
  const isProcessingScan = useRef(false);
  // Shared value to track camera active state (accessible in worklets)
  const cameraActiveShared = useSharedValue(false);

  // JS handler for a successful scan (must be outside frameProcessor)
  const handleBarCodeScanned = useCallback(
    (data: string) => {
      if (isProcessingScan.current || scanned) return;
      isProcessingScan.current = true;
      setScanned(true);
      setCameraActive(false); // Deactivate camera immediately after scan
      onScan(data);
    },
    [scanned, onScan]
  );

  // Create the runOnJS wrapper outside the frame processor
  const onBarCodeScanned = Worklets.createRunOnJS(handleBarCodeScanned);

  // Create error handler outside the frame processor
  const onError = Worklets.createRunOnJS((msg: string) => {
    console.error('QR Scanner frame processor error:', msg);
  });

  // Update shared value when cameraActive changes
  useEffect(() => {
    cameraActiveShared.value = cameraActive;
  }, [cameraActive, cameraActiveShared]);

  // Frame Processor (runs in a worklet context)
  // Note: This only runs when Camera isActive={true} and the component is mounted
  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      // Early return if camera is not active
      if (!cameraActiveShared.value) return;

      // Throttle barcode scanning to 3 FPS to reduce CPU usage
      runAtTargetFps(3, () => {
        'worklet';
        // Double-check camera is still active before processing
        if (!cameraActiveShared.value) return;

        try {
          const barcodes = zxing(frame, { multiple: true });

          // Handle both array and object formats
          let firstBarcode: any = null;
          if (Array.isArray(barcodes) && barcodes.length > 0) {
            firstBarcode = barcodes[0];
          } else if (barcodes && typeof barcodes === 'object') {
            const keys = Object.keys(barcodes);
            if (keys.length > 0) {
              firstBarcode = barcodes[keys[0]];
            }
          }

          // Validate barcode data before processing
          if (firstBarcode && typeof firstBarcode === 'object') {
            const barcodeText = firstBarcode.barcodeText || firstBarcode.displayValue || firstBarcode.text;
            if (barcodeText && typeof barcodeText === 'string' && barcodeText.length > 0) {
              // Call the runOnJS wrapper to invoke JS handler on the JS thread
              onBarCodeScanned(barcodeText);
            }
          }
        } catch (error) {
          // Log errors for debugging - convert error to string for serialization
          const errorMessage = error instanceof Error ? error.message : String(error);
          onError(errorMessage);
        }
      });
    },
    [onBarCodeScanned, onError]
  );

  const handleClose = () => {
    isProcessingScan.current = false;
    setScanned(false);
    setCameraActive(false); // Ensure camera is deactivated
    onClose();
  };

  // Control camera activation based on modal visibility and permission
  useEffect(() => {
    if (visible && hasPermission === true) {
      isProcessingScan.current = false;
      setCameraActive(true);
      setScanned(false);
    } else {
      setCameraActive(false);
    }
  }, [visible, hasPermission]);

  // Reset scanned state when modal closes
  useEffect(() => {
    if (!visible) {
      isProcessingScan.current = false;
      setScanned(false);
      setCameraActive(false);
    }
  }, [visible]);

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
          <Text style={styles.permissionText}>Please allow camera access to scan QR codes for adding 2FA services.</Text>
          <TouchableOpacity style={styles.closeButton} onPress={requestPermission}>
            <Text style={styles.closeButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.closeButton, { marginTop: 12, backgroundColor: '#6B7280' }]} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
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
          {device && hasPermission && cameraActive && visible && (
            <Camera
              style={styles.camera}
              device={device}
              isActive={cameraActive}
              frameProcessor={cameraActive ? frameProcessor : undefined}
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
