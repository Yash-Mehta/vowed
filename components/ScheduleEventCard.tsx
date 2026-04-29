import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

export interface ScheduleEvent {
  id: string;
  title: string;
  startTime: any;
  location: string;
  description: string | null;
  order: number;
  color?: 'sky' | 'leaf' | 'accent' | 'sand';
  icon?: string;
  primary?: boolean;
  dress?: string;
}

interface Props {
  event: ScheduleEvent;
  isNext: boolean;
  isPast: boolean;
  countdown: string | null;
}

const colorMap: Record<string, { bg: string; accent: string }> = {
  sky: { bg: '#E8F1F4', accent: '#5A8597' },
  leaf: { bg: '#E8EFE0', accent: theme.colors.leaf },
  accent: { bg: theme.colors.accentTint, accent: theme.colors.accentDeep },
  sand: { bg: '#F4ECDC', accent: '#9C7A48' },
};

export function ScheduleEventCard({ event, isNext, isPast, countdown }: Props) {
  const time = event.startTime?.toDate
    ? event.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const c = colorMap[event.color ?? 'accent'];

  return (
    <View
      style={[
        styles.card,
        isPast && styles.past,
        theme.shadows.s1,
      ]}>
      {isNext && <View style={styles.nextBar} />}
      {event.primary && (
        <Text style={styles.mainEyebrow}>♡ MAIN EVENT</Text>
      )}
      {isNext && countdown && <Text style={styles.countdown}>{countdown}</Text>}
      <View style={styles.row}>
        {event.icon ? (
          <View style={[styles.iconBox, { backgroundColor: event.primary ? 'rgba(255,255,255,0.18)' : c.bg }]}>
            <Text style={styles.iconEmoji}>{event.icon}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.time, isPast && styles.pastText, { color: c.accent }]}>{time}</Text>
          <Text style={[styles.title, isPast && styles.pastText, event.primary && styles.primaryTitle]}>
            {event.title}
          </Text>
          <Text style={[styles.location, isPast && styles.pastText]}>{event.location}</Text>
          {event.dress && (
            <View style={[styles.dressBadge, { backgroundColor: c.bg }]}>
              <Text style={[styles.dressText, { color: c.accent }]}>{event.dress}</Text>
            </View>
          )}
          {event.description ? (
            <Text style={[styles.description, isPast && styles.pastText]}>{event.description}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: 16,
    marginBottom: 10,
    marginHorizontal: 18,
    borderWidth: 0.5,
    borderColor: theme.colors.line,
  },
  nextBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.colors.accentDeep,
    borderTopLeftRadius: theme.radii.lg,
    borderBottomLeftRadius: theme.radii.lg,
  },
  past: { opacity: 0.45 },
  pastText: { color: theme.colors.ink4 },
  mainEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.accentDeep,
    marginBottom: 6,
    fontFamily: theme.fonts.sans,
  },
  countdown: {
    fontSize: 13,
    color: theme.colors.accentDeep,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: theme.fonts.sans,
  },
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 22 },
  time: { fontSize: 12, marginBottom: 3, fontFamily: theme.fonts.sans },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
  },
  primaryTitle: { fontFamily: theme.fonts.serifItalic, fontStyle: 'italic', fontSize: 20 },
  location: { fontSize: 12, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  dressBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dressText: { fontSize: 10, fontWeight: '600', fontFamily: theme.fonts.sans },
  description: { fontSize: 12, color: theme.colors.ink3, marginTop: 6, fontFamily: theme.fonts.sans },
});
