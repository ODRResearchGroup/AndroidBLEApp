import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoTaken: (photoPath: string) => void;
}

export default function CameraCapture({ visible, onClose, onPhotoTaken }: CameraModalProps) {
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isCapturing, setIsCapturing] = useState(false);

  const takePhoto = async () => {
    if (isCapturing) return;
    
    try {
      setIsCapturing(true);
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePhoto({
          flash: "auto",
          enableShutterSound: true,
        });
        onPhotoTaken(photo.path);
        onClose();
      }
    } catch (error) {
      console.error("Failed to take photo:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRequestPermission = async () => {
    const permission = await requestPermission();
    if (!permission) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!hasPermission ? (
          <View style={styles.permissionView}>
            <Text style={styles.permissionText}>
              Camera permission is required to take photos
            </Text>
            <TouchableOpacity
              onPress={handleRequestPermission}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.permissionButton, styles.cancelButton]}
            >
              <Text style={styles.permissionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : !device ? (
          <View style={styles.permissionView}>
            <Text style={styles.permissionText}>No camera device found</Text>
            <TouchableOpacity onPress={onClose} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Camera
              ref={cameraRef}
              photo={true}
              device={device}
              isActive={visible && !!device}
              style={StyleSheet.absoluteFill}
            />
            
            {/* Close button */}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            {/* Capture button */}
            <View style={styles.controls}>
              <TouchableOpacity
                onPress={takePhoto}
                style={styles.captureButton}
                disabled={isCapturing}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  permissionView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 20,
  },
  permissionText: {
    fontSize: 18,
    marginBottom: 20,
    color: "#fff",
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: "#007BFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 8,
    minWidth: 200,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#666",
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
  },
});