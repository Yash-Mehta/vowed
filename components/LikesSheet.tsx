import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { onSnapshotError } from '../lib/firestore';
import { Avatar } from './Avatar';
import { theme } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Like {
  uid: string;
  displayName: string;
  photoURL: string | null;
  likedAt: Timestamp | null;
}

interface Props {
  postId: string | null;
  onClose: () => void;
}

export function LikesSheet({ postId, onClose }: Props) {
  const [likes, setLikes] = useState<Like[]>([]);
  const { weddingId } = useAuthStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!postId || !weddingId) return;
    const q = query(
      collection(db, 'weddings', weddingId, 'posts', postId, 'likes'),
      orderBy('likedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setLikes(
        snap.docs.map((d) => ({
          uid: d.id,
          displayName: d.data().displayName ?? 'Guest',
          photoURL: d.data().photoURL ?? null,
          likedAt: d.data().likedAt ?? null,
        }))
      );
    }, onSnapshotError);
    return unsub;
  }, [postId, weddingId]);

  return (
    <Modal
      visible={!!postId}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>Liked by</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={likes}
          keyExtractor={(l) => l.uid}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar uri={item.photoURL} name={item.displayName} size={40} />
              <Text style={styles.name}>{item.displayName}</Text>
            </View>
          )}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No likes yet.</Text>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.card },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.lineStrong,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.ink,
    fontFamily: theme.fonts.serif,
  },
  close: { fontSize: 18, color: theme.colors.ink3, padding: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: theme.colors.line,
  },
  name: {
    fontSize: 15,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
  },
  empty: {
    textAlign: 'center',
    color: theme.colors.ink3,
    fontSize: 14,
    paddingVertical: 24,
    fontFamily: theme.fonts.sans,
  },
});
