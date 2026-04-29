import { useEffect, useState } from 'react';
import { FlatList, TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { UserDoc } from '../../lib/firestore';
import { theme } from '../../constants/theme';

interface GuestItem extends UserDoc {
  uid: string;
}

export default function GuestsScreen() {
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, 'users'));
      setGuests(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as GuestItem)));
      setLoading(false);
    }
    load();
  }, []);

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
            <Avatar uri={item.photoURL} name={item.displayName} size={64} />
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
});
