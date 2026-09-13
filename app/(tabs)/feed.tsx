import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  where,
  orderBy,
  onSnapshot,
  QueryDocumentSnapshot,
  doc,
  getDoc,
  getDocs,
  limit,
  startAfter,
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

// The live subscription is capped at this, so opening the feed no longer costs
// one read per post the wedding has ever made. Batches are fetched ahead of the
// scroll position, not on a button — the feed reads as one continuous scroll.
const PAGE_SIZE = 30;

// Start fetching the next batch when the user is still two screens from the
// bottom. At typical scroll speed the next batch has landed long before they
// reach it, so the spinner below is a fallback for slow connections rather than
// something seen in normal use.
const PREFETCH_SCREENS = 2;

export default function FeedScreen() {
  const [livePosts, setLivePosts] = useState<Post[]>([]);
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);
  const [olderPosts, setOlderPosts] = useState<Post[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  // Document snapshot, not a field value. startAfter(timestamp) excludes EVERY
  // document sharing that timestamp, so two photos uploaded in the same instant
  // would silently drop one from the feed. A snapshot cursor disambiguates by
  // document path and cannot skip.
  const cursorDoc = useRef<QueryDocumentSnapshot | null>(null);
  // Ref, not the loadingMore state: FlatList can fire onEndReached twice within
  // a tick, and both calls would read the same pre-commit state and fetch the
  // same page twice. The state below still drives the spinner.
  const fetching = useRef(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activeLikesPostId, setActiveLikesPostId] = useState<string | null>(null);
  const { firebaseUser, role, weddingId, userDoc } = useAuthStore();
  const { config, getDaysUntilWedding, getCountdownParts } = useWeddingStore();
  const router = useRouter();

  const daysAway = getDaysUntilWedding();
  const { days: cdDays, hours: cdHours, mins: cdMins } = getCountdownParts();

  // The live subscription covers only the newest page. That is where new posts
  // arrive and where everyone is looking during an event; older pages are
  // fetched once, on demand. Previously this subscribed to every post the
  // wedding had ever made, so opening the feed cost one read per post and held
  // them all live — fine at ten photos, not at a weekend's worth.
  useEffect(() => {
    if (!weddingId) return;
    setOlderPosts([]);
    setReachedEnd(false);
    cursorDoc.current = null;
    const q = query(postsCol(weddingId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    const unsub = onSnapshot(q, (snap) => {
      setLivePosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
      // Only seed the cursor from the live page; once older batches exist they
      // own it, or a live update would rewind paging to the end of page one.
      if (!cursorDoc.current && snap.docs.length > 0) {
        cursorDoc.current = snap.docs[snap.docs.length - 1];
      }
      setLoading(false);
    }, onSnapshotError);
    return unsub;
  }, [weddingId]);

  // Pinning exists to keep something visible regardless of age, so pinned posts
  // cannot rely on falling inside the newest page — a host pins an announcement
  // precisely so it outlives the scroll. Fetched separately and merged in.
  // Equality-only filter, so no composite index is required.
  useEffect(() => {
    if (!weddingId) return;
    const q = query(postsCol(weddingId), where('pinned', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => setPinnedPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post))),
      onSnapshotError
    );
    return unsub;
  }, [weddingId]);

  // Pinned first; Array.sort is stable, so createdAt order survives within each
  // group. Dedupes because a post can appear in more than one list — a pinned
  // post is usually also in the live page.
  const posts = useMemo(() => {
    const seen = new Set<string>();
    const merged: Post[] = [];
    for (const p of [...pinnedPosts, ...livePosts, ...olderPosts]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }
    // A just-created post arrives with createdAt null while its
    // serverTimestamp() is unresolved. It is the newest thing there is, so sort
    // it first rather than coercing to 0 and dropping it to the bottom.
    const at = (p: Post) => p.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
    return merged.sort((a, b) => {
      const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      // The pinned query returns no ordering of its own, so sort within the
      // group rather than relying on arrival order.
      return pin !== 0 ? pin : at(b) - at(a);
    });
  }, [pinnedPosts, livePosts, olderPosts]);

  const loadMore = useCallback(async () => {
    if (!weddingId || fetching.current || reachedEnd) return;
    const after = cursorDoc.current;
    if (!after) return;
    fetching.current = true;
    setLoadingMore(true);
    try {
      const snap = await getDocs(
        query(postsCol(weddingId), orderBy('createdAt', 'desc'), startAfter(after), limit(PAGE_SIZE))
      );
      if (snap.docs.length > 0) {
        cursorDoc.current = snap.docs[snap.docs.length - 1];
        setOlderPosts((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post))]);
      }
      if (snap.size < PAGE_SIZE) setReachedEnd(true);
    } catch {
      // Transient failures must not latch the feed shut — leave reachedEnd
      // alone so the next onEndReached retries rather than permanently
      // truncating the feed for the rest of the session.
    } finally {
      fetching.current = false;
      setLoadingMore(false);
    }
  }, [weddingId, reachedEnd]);

  // Was one live listener per post, purely to answer "did I like this?" — so a
  // 300-post feed opened 300 subscriptions and tore them all down every time a
  // new post arrived. Nobody but this user can change this user's like, and
  // handleLike already updates the set optimistically, so a subscription bought
  // nothing. One read per post instead, each post checked only once.
  const checkedLikes = useRef<Set<string>>(new Set());
  const inFlightLikes = useRef<Set<string>>(new Set());

  useEffect(() => {
    checkedLikes.current = new Set();
    inFlightLikes.current = new Set();
    setLikedIds(new Set());
  }, [weddingId, firebaseUser?.uid]);

  // `posts` gets a new identity on any change inside the live window — a like,
  // a comment, a new photo — which during an event is constant. So this effect
  // re-runs often, and an id must only count as checked once its own fetch has
  // actually landed. Marking the whole batch up front meant a re-render
  // mid-flight discarded the results and never retried, silently showing a
  // liked post as unliked for the rest of the session.
  useEffect(() => {
    if (!firebaseUser || !weddingId || posts.length === 0) return;
    const uid = firebaseUser.uid;
    const pending = posts.filter(
      (p) => !checkedLikes.current.has(p.id) && !inFlightLikes.current.has(p.id)
    );
    if (pending.length === 0) return;
    pending.forEach((p) => inFlightLikes.current.add(p.id));

    (async () => {
      const results = await Promise.all(
        pending.map(async (p) => {
          try {
            const snap = await getDoc(doc(db, 'weddings', weddingId, 'posts', p.id, 'likes', uid));
            return { id: p.id, liked: snap.exists() };
          } catch {
            // Leave it unchecked so a later pass retries.
            return null;
          }
        })
      );
      pending.forEach((p) => inFlightLikes.current.delete(p.id));
      const hits: string[] = [];
      results.forEach((r) => {
        if (!r) return;
        checkedLikes.current.add(r.id);
        if (r.liked) hits.push(r.id);
      });
      if (hits.length > 0) setLikedIds((prev) => new Set([...prev, ...hits]));
    })();
  }, [posts, firebaseUser?.uid, weddingId]);

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
          deleteDoc(doc(db, 'weddings', weddingId, 'posts', post.id))
            .then(() => {
              // Older pages are a one-shot fetch with no listener, so a post
              // that has scrolled out of the live window would otherwise stay
              // on screen for the very person who just deleted it.
              setOlderPosts((prev) => prev.filter((p) => p.id !== post.id));
            })
            .catch(() => Alert.alert('Error', 'Could not delete post.')),
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
        onEndReached={loadMore}
        onEndReachedThreshold={PREFETCH_SCREENS}
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
                  <Text style={styles.headerEyebrow}>
                    {role === 'host' ? 'VOWED · HOSTING' : 'VOWED'}
                  </Text>
                  <Text style={styles.headerTitle}>{coupleName}</Text>
                </View>
              </View>
            </View>

            <LinearGradient
              colors={[theme.colors.wineDeep, theme.colors.countdownEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.countdown}>
              <View style={styles.countdownFrame} pointerEvents="none" />
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
        renderItem={({ item }) => {
          const isOwnPost = item.authorId === firebaseUser?.uid;
          const canDelete = role === 'host' || isOwnPost;
          return item.type === 'announcement' ? (
            <AnnouncementCard
              post={item}
              isHost={role === 'host'}
              isOwnPost={isOwnPost}
              onTogglePin={role === 'host' ? () => handleTogglePin(item) : undefined}
              onDelete={canDelete ? () => handleDelete(item) : undefined}
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
              isOwnPost={isOwnPost}
              onDelete={canDelete ? () => handleDelete(item) : undefined}
              onTogglePin={role === 'host' ? () => handleTogglePin(item) : undefined}
              onEdit={role === 'host' ? (caption) => handleEditCaption(item, caption) : undefined}
              onDownload={
                role === 'host' && (item.photoURL || item.photoURLs?.length)
                  ? (url) => handleDownload(item, url)
                  : undefined
              }
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No posts yet"
            subtitle="The hosts will post photos and announcements here"
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={theme.colors.accent} />
          ) : posts.length > 0 && reachedEnd ? (
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
  headerEyebrow: {
    ...theme.type.eyebrow,
    color: theme.colors.gold,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    lineHeight: 26,
    marginTop: 1,
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
  countdownFrame: {
    ...StyleSheet.absoluteFillObject,
    margin: 5,
    borderRadius: theme.radii.lg - 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.goldSoft,
    opacity: 0.55,
  },
  countdownSprig: { position: 'absolute', right: -12, top: -12, opacity: 0.18 },
  countdownLeft: { flex: 1 },
  countdownEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: theme.colors.goldSoft,
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
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(217, 192, 138, 0.4)',
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
