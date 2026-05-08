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
import { useAuthStore } from '../store/authStore';
import { getMember, getWeddingPreviews, WeddingPreview } from '../lib/firestore';
import { registerForPushNotifications } from '../lib/notifications';
import { auth } from '../lib/firebase';
import { theme } from '../constants/theme';

export default function SelectWeddingScreen() {
  const router = useRouter();
  const { userWeddingIds, switchWedding } = useAuthStore();
  const [previews, setPreviews] = useState<WeddingPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    if (userWeddingIds.length === 0) {
      setLoading(false);
      return;
    }
    getWeddingPreviews(userWeddingIds)
      .then(setPreviews)
      .finally(() => setLoading(false));
  }, [userWeddingIds]);

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
        colors={[theme.colors.countdownStart, theme.colors.countdownEnd]}
        style={styles.header}>
        <Text style={styles.appName}>Vowed</Text>
        <Text style={styles.subtitle}>Choose a wedding party</Text>
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
              <Text style={styles.addRowText}>+ Add another wedding party</Text>
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
  },
  appName: {
    fontSize: 40,
    fontFamily: theme.fonts.serif,
    color: theme.colors.bg,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(250,246,241,0.75)',
    fontFamily: theme.fonts.sans,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  list: { padding: 24 },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
    ...theme.shadows.s1,
  },
  cardContent: { flex: 1 },
  coupleName: {
    fontSize: 20,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    marginBottom: 4,
  },
  dateStamp: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.colors.ink3,
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
