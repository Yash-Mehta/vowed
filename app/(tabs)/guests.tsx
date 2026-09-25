import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  SectionList,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  PixelRatio,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { onSnapshot } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { membersCol, onSnapshotError } from '../../lib/firestore';
import {
  GuestEntry,
  GuestMember,
  COLUMNS_BY_VARIANT,
  buildGuestGroups,
  chunk,
  toEntry,
} from '../../lib/guestSections';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { EmptyState } from '../../components/EmptyState';
import { GuestTile } from '../../components/guests/GuestTile';
import { GuestSectionHeader } from '../../components/guests/GuestSectionHeader';
import { GuestSearchField } from '../../components/guests/GuestSearchField';
import { theme } from '../../constants/theme';

const H_PAD = theme.space.l;
const ROW_GAP: Record<string, number> = { large: theme.space.xl, medium: theme.space.l, compact: theme.space.m };

export default function GuestsScreen() {
  const [members, setMembers] = useState<GuestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const { weddingId } = useAuthStore();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // React 19 — the input stays responsive while filtering runs at lower
  // priority, with no debounce timer to own or clean up.
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    // Previously an early return here left `loading` true forever, so a signed
    // in user with no wedding selected saw an endless spinner.
    if (!weddingId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      membersCol(weddingId),
      (snap) => {
        setMembers(snap.docs.map((d) => toEntry({ uid: d.id, ...d.data() } as GuestMember)));
        setLoading(false);
      },
      onSnapshotError
    );
    return unsub;
  }, [weddingId]);

  const groups = useMemo(() => buildGuestGroups(members, deferredQuery), [members, deferredQuery]);

  const sections = useMemo(
    () =>
      groups.map((group) => {
        const base = COLUMNS_BY_VARIANT[group.variant];
        // At large accessibility text sizes a fixed column count crushes the
        // names, so drop one column rather than letting them wrap to nothing.
        // The couple stays at two — a single full-width tile would read as a
        // different screen.
        const columns =
          group.variant === 'large' || PixelRatio.getFontScale() <= 1.35 ? base : Math.max(2, base - 1);
        const gap = ROW_GAP[group.variant];
        const tileWidth = (width - H_PAD * 2 - gap * (columns - 1)) / columns;
        return { ...group, columns, gap, tileWidth, data: chunk(group.items, columns) };
      }),
    [groups, width]
  );

  // One stable callback for every tile — a fresh arrow per item would defeat
  // the memo on GuestTile.
  const onSelect = useCallback((uid: string) => router.push(`/guest/${uid}`), [router]);

  const total = members.length;
  const searching = deferredQuery.trim().length > 0;

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator style={{ flex: 1 }} color={theme.colors.accent} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.map((entry) => entry.uid).join('|')}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* No "Guests" title: the tab bar already says Guests, and dropping
                it lets the couple's names be the largest type on the page. */}
            <Text style={styles.eyebrow}>
              THE GUEST LIST{total > 0 ? ` · ${total}` : ''}
            </Text>
            <View style={styles.searchWrap}>
              <GuestSearchField value={query} onChange={setQuery} />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <GuestSectionHeader
            title={section.title}
            count={section.items.length}
            centred={section.key === 'couple'}
          />
        )}
        renderItem={({ item: row, section }) => (
          <View style={[styles.row, { gap: section.gap, marginBottom: section.gap }]}>
            {row.map((entry) => (
              <GuestTile
                key={entry.uid}
                uid={entry.uid}
                name={entry.name}
                photoURL={entry.photoURL}
                blurb={entry.blurb}
                isSingle={entry.isSingle}
                variant={section.variant}
                width={section.tileWidth}
                sectionTitle={section.title}
                onSelect={onSelect}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          searching ? (
            <EmptyState title="No one by that name" subtitle={`No guests match "${deferredQuery.trim()}"`} />
          ) : (
            <EmptyState title="No guests yet" subtitle="Guests will appear here once they join" />
          )
        }
        // EmptyState is flex: 1, which collapses to zero height inside a
        // content container that isn't allowed to grow.
        contentContainerStyle={[
          styles.content,
          sections.length === 0 && styles.contentEmpty,
        ]}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: H_PAD, paddingBottom: 100 },
  contentEmpty: { flexGrow: 1 },
  header: { paddingTop: theme.space.s },
  eyebrow: {
    ...theme.type.eyebrow,
    color: theme.colors.gold,
    fontWeight: '600',
    fontFamily: theme.fonts.sans,
  },
  searchWrap: { marginTop: theme.space.l },
  // stretch so tiles in a row match the tallest and their bottoms stay flush
  // when a name wraps at large text sizes.
  row: { flexDirection: 'row', alignItems: 'stretch' },
});
