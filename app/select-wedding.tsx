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
import { signOut } from 'firebase/auth';
import { useAuthStore } from '../store/authStore';
import { getMember, getWeddingPreviews, leaveWedding, WeddingPreview } from '../lib/firestore';
import { registerForPushNotifications } from '../lib/notifications';
import { auth } from '../lib/firebase';
import { clearCredentials } from '../lib/secureAuth';
import { Sprig } from '../components/Sprig';
import { theme } from '../constants/theme';

export default function SelectWeddingScreen() {
  const router = useRouter();
  const { userWeddingIds, switchWedding, setUserWeddingIds } = useAuthStore();

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => { await clearCredentials(); signOut(auth); },
      },
    ]);
  }
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

  async function handleSelect(weddingId: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setJoining(weddingId);
    try {
      const memberDoc = await getMember(weddingId, uid);
      if (!memberDoc) {
        Alert.alert("Not a member", "You've been removed from this wedding party.");
        return;
      }
      switchWedding(weddingId, memberDoc);
      registerForPushNotifications(uid, weddingId).catch(() => {});
      // _layout.tsx routing fires on weddingId change and navigates to tabs
    } catch (e: any) {
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
        <View style={styles.sprigRow}>
          <Sprig size={34} color={theme.colors.goldSoft} flip />
          <Sprig size={34} color={theme.colors.goldSoft} />
        </View>
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
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={styles.signOutText}>Sign out</Text>
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
            <View>
              <TouchableOpacity
                style={styles.addRow}
                onPress={() => router.push('/(auth)/invite')}
                activeOpacity={0.7}>
                <Text style={styles.addRowText}>+ Add a wedding party</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
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
  },
  sprigRow: { flexDirection: 'row', gap: 12, marginBottom: 4, opacity: 0.9 },
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
  signOutRow: { paddingVertical: 12, alignItems: 'center' },
  signOutText: { fontSize: 13, color: theme.colors.ink4, fontFamily: theme.fonts.sans },
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
