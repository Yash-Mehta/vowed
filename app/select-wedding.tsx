import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { getMember, getWeddingPreviews, leaveWedding, WeddingPreview } from '../lib/firestore';
import { registerForPushNotifications } from '../lib/notifications';
import { auth } from '../lib/firebase';
import { theme } from '../constants/theme';

export default function SelectWeddingScreen() {
  const router = useRouter();
  const { userWeddingIds, switchWedding, setUserWeddingIds } = useAuthStore();
  const [previews, setPreviews] = useState<WeddingPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    const uniqueIds = [...new Set(userWeddingIds)];
    if (uniqueIds.length === 0) {
      setLoading(false);
      return;
    }
    getWeddingPreviews(uniqueIds)
      .then(setPreviews)
      .finally(() => setLoading(false));
  }, [userWeddingIds]);

  function handleLongPress(item: WeddingPreview) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    Alert.alert(
      `Leave ${item.coupleName}?`,
      'You will be removed from this wedding party. You can rejoin with an invite code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveWedding(uid, item.weddingId);
              const updated = userWeddingIds.filter((id) => id !== item.weddingId);
              setUserWeddingIds(updated);
              setPreviews((prev) => prev.filter((p) => p.weddingId !== item.weddingId));
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Could not leave this wedding party.');
            }
          },
        },
      ]
    );
  }

  // Prunes a wedding the user is no longer a member of: clears it from the
  // user index and from local state so the stale card disappears instead of
  // sitting there failing every time it's tapped.
  async function dropStaleWedding(uid: string, weddingId: string) {
    try {
      await leaveWedding(uid, weddingId);
    } catch {
      // Best-effort cleanup — still update the UI either way.
    }
    setUserWeddingIds(userWeddingIds.filter((id) => id !== weddingId));
    setPreviews((prev) => prev.filter((p) => p.weddingId !== weddingId));
    Alert.alert('No longer a member', "You've been removed from this wedding party.");
  }

  async function handleSelect(weddingId: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setJoining(weddingId);
    try {
      const memberDoc = await getMember(weddingId, uid);
      if (!memberDoc) {
        await dropStaleWedding(uid, weddingId);
        return;
      }
      switchWedding(weddingId, memberDoc);
      registerForPushNotifications(uid, weddingId).catch(() => {});
      // _layout.tsx routing fires on weddingId change and navigates to tabs
    } catch (e: any) {
      // firestore.rules gates member reads on isMember, so a member who was
      // removed gets permission-denied rather than a null doc — the null
      // branch above is effectively unreachable for that case. Without this,
      // being removed surfaced as raw "Missing or insufficient permissions"
      // and the dead card stayed in the list.
      if (e?.code === 'permission-denied') {
        await dropStaleWedding(uid, weddingId);
        return;
      }
      Alert.alert('Error', e.message ?? 'Could not join this wedding.');
    } finally {
      setJoining(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.wineDeep, theme.colors.countdownEnd]}
        style={styles.header}>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          hitSlop={12}>
          <Ionicons name="settings-outline" size={22} color={theme.colors.creamOnWine} />
        </TouchableOpacity>
        <Text style={styles.appName}>Vowed</Text>
        <View style={styles.headerRule} />
        <Text style={styles.subtitle}>choose your wedding party</Text>
      </LinearGradient>

      {previews.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No wedding parties</Text>
          <Text style={styles.emptySub}>
            Use an invite code from your couple to join a wedding party.
          </Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(auth)/invite')}
            activeOpacity={0.85}>
            <Text style={styles.addBtnText}>Add a wedding party</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={previews}
          keyExtractor={(item) => item.weddingId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleSelect(item.weddingId)}
              onLongPress={() => handleLongPress(item)}
              activeOpacity={0.8}
              disabled={!!joining}>
              <View style={styles.cardContent}>
                <Text style={styles.coupleName}>{item.coupleName}</Text>
                {!!item.dateStamp && (
                  <Text style={styles.dateStamp}>{item.dateStamp}</Text>
                )}
              </View>
              {joining === item.weddingId ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addRow}
              onPress={() => router.push('/(auth)/invite')}
              activeOpacity={0.7}>
              <Text style={styles.addRowText}>+ Add a wedding party</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 80,
    paddingBottom: 36,
    paddingHorizontal: 32,
    alignItems: 'center',
    position: 'relative',
  },
  settingsBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 40,
    fontFamily: theme.fonts.serif,
    color: theme.colors.bg,
    letterSpacing: 1,
  },
  headerRule: {
    width: 72,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: theme.colors.goldSoft,
    opacity: 0.7,
    marginTop: 10,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.creamOnWine,
    fontFamily: theme.fonts.serifItalic,
    letterSpacing: 0.4,
  },
  list: { padding: 24 },
  card: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.lg,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
    ...theme.shadows.s2,
  },
  cardContent: { flex: 1 },
  coupleName: {
    fontSize: 21,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    marginBottom: 4,
  },
  dateStamp: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.gold,
    fontFamily: theme.fonts.sans,
  },
  chevron: {
    fontSize: 26,
    color: theme.colors.ink4,
    lineHeight: 28,
  },
  addRow: { paddingVertical: 16, alignItems: 'center' },
  addRowText: {
    fontSize: 14,
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink3,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  addBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  addBtnText: {
    color: theme.colors.bg,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: theme.fonts.sans,
  },
});
