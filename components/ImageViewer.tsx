// Full-screen view of a single image, for tapping an avatar.
//
// Avatars live at the fixed path avatars/{uid}.jpg and are stored at one
// resolution, so this is the same URL rendered large rather than a separate
// full-size asset. That also means it inherits Avatar's failure mode: replacing
// a photo revokes the previous download token, so a stale URL returns 403. A
// black rectangle would read as a broken app, so a failed load says so.

import { useEffect, useState } from 'react';
import { Modal, View, Image, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

interface Props {
  uri: string | null;
  name: string;
  visible: boolean;
  onClose: () => void;
}

export function ImageViewer({ uri, name, visible, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);

  // Reopening after a failure, or on a different photo, must start clean.
  useEffect(() => {
    if (visible) setFailed(false);
  }, [visible, uri]);

  return (
    <Modal
      visible={visible && !!uri}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android's hardware back button, which otherwise leaves the modal stuck.
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close photo">
        {failed ? (
          <Text style={styles.failed}>This photo is no longer available</Text>
        ) : (
          <Image
            source={{ uri: uri ?? undefined }}
            onError={() => setFailed(true)}
            resizeMode="contain"
            accessibilityLabel={`${name}'s photo`}
            style={{ width, height: height * 0.8 }}
          />
        )}
      </Pressable>

      <Pressable
        onPress={onClose}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.close, { top: top + 8 }]}>
        <Ionicons name="close" size={26} color="#FFFFFF" />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Near-black rather than the app's cream: a photo reads truer against it, and
  // it signals that this is a layer over the screen rather than a new one.
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 10, 8, 0.97)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  close: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failed: {
    color: theme.colors.ink4,
    fontSize: 15,
    fontFamily: theme.fonts.sans,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
});
