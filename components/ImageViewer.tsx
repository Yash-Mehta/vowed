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

  // No `if (visible)` guard: leaving `failed` set on close meant the first
  // frame of a reopen still rendered the error, and with a fade-in that stale
  // message was on screen for the whole transition before the image swapped
  // in. Clearing on close runs before the reopen render, so there is no flash.
  useEffect(() => setFailed(false), [visible, uri]);

  return (
    <Modal
      // Visibility is the parent's alone. `visible && !!uri` desynced: if the
      // photo went null on a snapshot while the viewer was open, the Modal
      // closed but the parent's state stayed true — and a later snapshot
      // restoring a photo reopened the viewer with no user action. The missing
      // photo is handled in the content below instead.
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android's hardware back button, which otherwise leaves the modal stuck.
      onRequestClose={onClose}>
      {/* accessible={false}: a Pressable is accessible by default, and a
          full-screen one absorbs its descendants — VoiceOver announced only
          "Close photo" and never reached the image's label or the failure
          message. The X button below carries the labelled dismiss affordance. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        {!uri || failed ? (
          <Text style={styles.failed}>This photo is no longer available</Text>
        ) : (
          <Image
            source={{ uri }}
            onError={() => setFailed(true)}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${name}'s photo`}
            // Leaves room for the close button above and matches the square
            // avatars this shows, which fit by width on every phone.
            style={{ width, height: height - (top + 56) * 2 }}
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
