import { useEffect, useState } from 'react';
import { FlatList, TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { onSnapshot } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { membersCol, UserDoc } from '../../lib/firestore';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { theme } from '../../constants/theme';

interface GuestItem extends UserDoc {
  uid: string;
}

export default function GuestsScreen() {
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { weddingId } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!weddingId) return;
    const unsub = onSnapshot(membersCol(weddingId), (snap) => {
      setGuests(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as GuestItem)));
      setLoading(false);
    }, (err) => { if (err.code !== 'permission-denied') console.warn(err); });
    return unsub;
  }, [weddingId]);

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator style={{ flex: 1 }} color={theme.colors.accent} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <FlatList
        data={guests}
        keyExtractor={(g) => g.uid}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.header}>Guests</Text>
            <Text style={styles.sub}>{guests.length} attending</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/guest/${item.uid}`)}
            activeOpacity={0.8}>
            <View style={styles.avatarWrap}>
              <Avatar uri={item.photoURL} name={item.displayName} size={64} />
              {item.isSingle && (
                <View style={styles.singleBadge}>
                  <Text style={styles.singleBadgeText}>S</Text>
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={styles.blurb} numberOfLines={2}>
              {item.howTheyKnow}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No guests yet"
            subtitle="Guests will appear here once they join"
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        columnWrapperStyle={{ gap: 10 }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 12 },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.ink,
    fontFamily: theme.fonts.serif,
  },
  sub: { fontSize: 12, color: theme.colors.ink3, marginTop: 2, fontFamily: theme.fonts.sans },
  card: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: theme.colors.line,
    ...theme.shadows.s1,
  },
  name: {
    fontWeight: '600',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
  },
  blurb: {
    fontSize: 12,
    color: theme.colors.ink3,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: theme.fonts.sans,
  },
  avatarWrap: {
    position: 'relative',
  },
  singleBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8B84B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.card,
  },
  singleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.card,
    fontFamily: theme.fonts.sans,
  },
});
