import { useEffect, useState } from 'react';
import { FlatList, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { useWeddingStore } from '../../store/weddingStore';
import { scheduleCol, onSnapshotError } from '../../lib/firestore';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ScheduleEventCard, ScheduleEvent } from '../../components/ScheduleEventCard';
import { EmptyState } from '../../components/EmptyState';
import { theme } from '../../constants/theme';

function useCountdown(targetDate: Date | null): string | null {
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('Now!');
        return;
      }
      const days = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (days > 0) setCountdown(`${days}d ${h}h ${m}m`);
      else if (h > 0) setCountdown(`${h}h ${m}m`);
      else setCountdown(`${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return countdown;
}

export default function ScheduleScreen() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { role, weddingId } = useAuthStore();
  const { config } = useWeddingStore();

  useEffect(() => {
    if (!weddingId) return;
    const q = query(scheduleCol(weddingId), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleEvent)));
      setLoading(false);
    }, onSnapshotError);
    return unsub;
  }, [weddingId]);

  const now = Date.now();
  const nextEvent =
    events.find((e) => e.startTime?.toDate && e.startTime.toDate().getTime() > now) ?? null;
  const nextDate = nextEvent?.startTime?.toDate ? nextEvent.startTime.toDate() : null;
  const countdown = useCountdown(nextDate);

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator style={{ flex: 1 }} color={theme.colors.accent} />
      </ScreenWrapper>
    );
  }

  const headingSub = config ? `${config.venueShort} · ${config.location}` : '';

  return (
    <ScreenWrapper>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.eyebrow}>
              {role === 'host' ? '✦ Hosting · Weekend' : 'Wedding weekend'}
            </Text>
            <Text style={styles.heading}>
              {config?.coupleName ?? 'Vowed'}
            </Text>
            {!!headingSub && <Text style={styles.sub}>{headingSub}</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const isPast = item.startTime?.toDate && item.startTime.toDate().getTime() < now;
          const isNext = item.id === nextEvent?.id;
          return (
            <ScheduleEventCard
              event={item}
              isNext={isNext}
              isPast={!!isPast}
              countdown={isNext ? countdown : null}
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="Schedule coming soon"
            subtitle="The hosts are still finalising the day"
          />
        }
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 100 }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: theme.colors.gold,
    fontFamily: theme.fonts.sans,
    marginBottom: 4,
  },
  heading: {
    fontSize: 32,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    lineHeight: 36,
  },
  sub: { fontSize: 12, color: theme.colors.ink3, marginTop: 4, fontFamily: theme.fonts.sans },
});
