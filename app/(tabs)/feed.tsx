import { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  View,
  Text,
  Image,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { useWeddingStore } from '../../store/weddingStore';
import { postsCol, onSnapshotError } from '../../lib/firestore';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { PostCard, Post } from '../../components/PostCard';
import { AnnouncementCard } from '../../components/AnnouncementCard';
import { CommentSheet } from '../../components/CommentSheet';
import { LikesSheet } from '../../components/LikesSheet';
import { EmptyState } from '../../components/EmptyState';
import { Sprig } from '../../components/Sprig';
import { theme } from '../../constants/theme';

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activeLikesPostId, setActiveLikesPostId] = useState<string | null>(null);
  const { firebaseUser, role, weddingId, userDoc } = useAuthStore();
  const { config, getDaysUntilWedding, getCountdownParts } = useWeddingStore();
  const router = useRouter();

  const daysAway = getDaysUntilWedding();
  const { days: cdDays, hours: cdHours, mins: cdMins } = getCountdownParts();

  useEffect(() => {
    if (!weddingId) return;
    const q = query(postsCol(weddingId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      setPosts(all.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
      setLoading(false);
    }, onSnapshotError);
    return unsub;
  }, [weddingId]);

  useEffect(() => {
    if (!firebaseUser || !weddingId || posts.length === 0) return;
    const uid = firebaseUser.uid;
    const unsubscribers: (() => void)[] = [];
    posts.forEach((post) => {
      const likeRef = doc(db, 'weddings', weddingId, 'posts', post.id, 'likes', uid);
      const unsub = onSnapshot(likeRef, (snap) => {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (snap.exists()) next.add(post.id);
          else next.delete(post.id);
          return next;
        });
      }, onSnapshotError);
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach((u) => u());
  }, [posts.length, firebaseUser?.uid, weddingId]);

  const handleLike = useCallback(
    async (post: Post) => {
      if (!firebaseUser || !weddingId) return;
      const uid = firebaseUser.uid;
      const likeRef = doc(db, 'weddings', weddingId, 'posts', post.id, 'likes', uid);
      const isLiked = likedIds.has(post.id);

      // Optimistically update so the heart responds immediately on all platforms
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(post.id);
        else next.add(post.id);
        return next;
      });

      try {
        if (isLiked) {
          await deleteDoc(likeRef);
        } else {
          await setDoc(likeRef, {
            likedAt: new Date(),
            displayName: userDoc?.displayName ?? '',
            photoURL: userDoc?.photoURL ?? null,
          });
        }
      } catch {
        // Revert optimistic update on failure
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (isLiked) next.add(post.id);
          else next.delete(post.id);
          return next;
        });
      }
    },
    [firebaseUser, likedIds, weddingId]
  );

  async function handleDelete(post: Post) {
    if (!weddingId) return;
    Alert.alert('Delete post', 'This will permanently remove the post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteDoc(doc(db, 'weddings', weddingId, 'posts', post.id)).catch(() =>
            Alert.alert('Error', 'Could not delete post.')
          ),
      },
    ]);
  }

  async function handleTogglePin(post: Post) {
    if (!weddingId) return;
    await updateDoc(doc(db, 'weddings', weddingId, 'posts', post.id), { pinned: !post.pinned }).catch(() =>
      Alert.alert('Error', 'Could not update post.')
    );
  }

  async function handleEditCaption(post: Post, caption: string) {
    if (!weddingId) return;
    await updateDoc(doc(db, 'weddings', weddingId, 'posts', post.id), { caption }).catch(() =>
      Alert.alert('Error', 'Could not update announcement.')
    );
  }

  async function handleDownload(post: Post, url: string) {
    if (!url) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access to save photos.');
        return;
      }
      const fileName = `vowed_${post.id}_${Date.now()}.jpg`;
      const localUri = FileSystem.cacheDirectory + fileName;
      const { uri } = await FileSystem.downloadAsync(url, localUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Photo saved to your camera roll.');
    } catch {
      Alert.alert('Error', 'Could not save the photo. Please try again.');
    }
  }

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator style={{ flex: 1 }} color={theme.colors.accent} />
      </ScreenWrapper>
    );
  }

  const coupleName = config?.coupleName ?? 'Vowed';
  const countdownSub = config ? `${config.dateStamp} · ${config.venueShort}` : '';

  return (
    <ScreenWrapper>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        extraData={likedIds}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                {config?.coverPhotoURL ? (
                  <Image source={{ uri: config.coverPhotoURL }} style={[styles.headerLogoCircle, styles.headerLogo]} resizeMode="cover" />
                ) : (
                  <View style={[styles.headerLogoCircle, styles.headerMonogram]}>
                    <Text style={styles.headerMonogramText}>{config?.monogramInitials ?? '♡'}</Text>
                  </View>
                )}
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.headerTitle}>Vowed</Text>
                  <Text style={styles.headerSub}>
                    {role === 'host' ? '✦ Hosting view' : coupleName}
                  </Text>
                </View>
              </View>
            </View>

            <LinearGradient
              colors={[theme.colors.countdownStart, theme.colors.countdownEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.countdown}>
              <View style={styles.countdownSprig}>
                <Sprig size={120} color="rgba(255,255,255,0.9)" />
              </View>
              <View style={styles.countdownLeft}>
                <Text style={styles.countdownEyebrow}>COUNTDOWN</Text>
                <Text style={styles.countdownDisplay}>
                  {daysAway} days till{' '}
                  <Text style={{ fontStyle: 'italic' }}>I do</Text>
                </Text>
                <Text style={styles.countdownSub}>{countdownSub}</Text>
              </View>
              <View style={styles.countdownTiles}>
                {[
                  { n: String(cdDays), l: 'DAYS' },
                  { n: String(cdHours), l: 'HRS' },
                  { n: String(cdMins), l: 'MIN' },
                ].map((x) => (
                  <View key={x.l} style={styles.tile}>
                    <Text style={styles.tileNumber}>{x.n}</Text>
                    <Text style={styles.tileLabel}>{x.l}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </>
        }
        renderItem={({ item }) =>
          item.type === 'announcement' ? (
            <AnnouncementCard
              post={item}
              isHost={role === 'host'}
              onTogglePin={role === 'host' ? () => handleTogglePin(item) : undefined}
              onDelete={role === 'host' ? () => handleDelete(item) : undefined}
              onEdit={role === 'host' ? (caption) => handleEditCaption(item, caption) : undefined}
            />
          ) : (
            <PostCard
              post={item}
              liked={likedIds.has(item.id)}
              onLike={() => handleLike(item)}
              onLikeCountPress={() => setActiveLikesPostId(item.id)}
              onCommentPress={() => setActivePostId(item.id)}
              isHost={role === 'host'}
              onDelete={role === 'host' ? () => handleDelete(item) : undefined}
              onTogglePin={role === 'host' ? () => handleTogglePin(item) : undefined}
              onEdit={role === 'host' ? (caption) => handleEditCaption(item, caption) : undefined}
              onDownload={
                role === 'host' && (item.photoURL || item.photoURLs?.length)
                  ? (url) => handleDownload(item, url)
                  : undefined
              }
            />
          )
        }
        ListEmptyComponent={
          <EmptyState
            title="No posts yet"
            subtitle="The hosts will post photos and announcements here"
          />
        }
        ListFooterComponent={
          posts.length > 0 ? (
            <Text style={styles.footer}>The story is just beginning ·</Text>
          ) : null
        }
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 100 }}
      />

      {(role === 'host' || role === 'guest') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/compose')}
          activeOpacity={0.85}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <CommentSheet postId={activePostId} onClose={() => setActivePostId(null)} />
      <LikesSheet postId={activeLikesPostId} onClose={() => setActiveLikesPostId(null)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogoCircle: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  headerLogo: { width: 36, height: 36 },
  headerMonogram: {
    backgroundColor: theme.colors.accentTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMonogramText: {
    fontSize: 13,
    fontFamily: theme.fonts.serif,
    fontWeight: '600',
    color: theme.colors.accentDeep,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    lineHeight: 26,
  },
  headerSub: {
    fontSize: 10,
    color: theme.colors.ink3,
    letterSpacing: 0.8,
    marginTop: 2,
    fontFamily: theme.fonts.sans,
  },
  countdown: {
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 14,
    borderRadius: theme.radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...theme.shadows.s2,
  },
  countdownSprig: { position: 'absolute', right: -12, top: -12, opacity: 0.18 },
  countdownLeft: { flex: 1 },
  countdownEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: 'rgba(250,246,241,0.7)',
    fontFamily: theme.fonts.sans,
  },
  countdownDisplay: {
    fontSize: 20,
    fontFamily: theme.fonts.serif,
    color: theme.colors.bg,
    lineHeight: 24,
    marginTop: 2,
  },
  countdownSub: {
    fontSize: 11,
    color: theme.colors.bg,
    opacity: 0.85,
    marginTop: 4,
    fontFamily: theme.fonts.sans,
  },
  countdownTiles: { flexDirection: 'row', gap: 8 },
  tile: {
    width: 44,
    height: 56,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  tileNumber: {
    fontFamily: theme.fonts.serif,
    fontSize: 22,
    fontWeight: '500',
    color: theme.colors.bg,
    lineHeight: 26,
  },
  tileLabel: {
    fontSize: 9,
    color: theme.colors.bg,
    opacity: 0.85,
    marginTop: 2,
    letterSpacing: 1,
    fontFamily: theme.fonts.sans,
  },
  footer: {
    textAlign: 'center',
    padding: 12,
    color: theme.colors.ink3,
    fontSize: 11,
    fontFamily: theme.fonts.serifItalic,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.s3,
  },
  fabText: { color: theme.colors.bg, fontSize: 28, lineHeight: 32, fontFamily: theme.fonts.sans },
});
