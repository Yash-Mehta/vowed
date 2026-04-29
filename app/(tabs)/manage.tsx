import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
  ScrollView,
} from 'react-native';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserDoc } from '../../lib/firestore';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { GuestRow } from '../../components/GuestRow';
import { theme } from '../../constants/theme';

type Tab = 'guests' | 'schedule';
type EventColor = 'sky' | 'leaf' | 'accent' | 'sand';

const COLOR_OPTIONS: { value: EventColor; label: string; bg: string }[] = [
  { value: 'accent', label: 'Rose',  bg: theme.colors.accentTint },
  { value: 'sky',    label: 'Sky',   bg: '#E8F1F4' },
  { value: 'leaf',   label: 'Leaf',  bg: '#E8EFE0' },
  { value: 'sand',   label: 'Sand',  bg: '#F4ECDC' },
];

const DATE_OPTIONS = [
  { value: '02', label: 'Wed\nDec 2' },
  { value: '03', label: 'Thu\nDec 3' },
  { value: '04', label: 'Fri\nDec 4' },
  { value: '05', label: 'Sat\nDec 5' },
  { value: '06', label: 'Sun\nDec 6' },
  { value: '07', label: 'Mon\nDec 7' },
];

interface GuestItem extends UserDoc { uid: string }
interface ScheduleItem {
  id: string;
  title: string;
  location: string;
  description: string | null;
  order: number;
  startTime: any;
  icon?: string;
  color?: EventColor;
  dress?: string;
  primary?: boolean;
}

function parseTimeToTimestamp(timeStr: string, dateDay: string): Timestamp | null {
  const clean = timeStr.trim().toLowerCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  const d = new Date(`2026-12-${dateDay.padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

function formatTimestamp(ts: any): { time: string; day: string } {
  if (!ts?.toDate) return { time: '', day: '05' };
  const d: Date = ts.toDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const time = `${h}:${String(minutes).padStart(2, '0')} ${period}`;
  const day = String(d.getDate()).padStart(2, '0');
  return { time, day };
}

const BLANK_EVENT = {
  title: '', location: '', description: '', time: '', day: '05',
  icon: '', color: 'accent' as EventColor, dress: '', primary: false,
};

export default function ManageScreen() {
  const [tab, setTab] = useState<Tab>('guests');
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [events, setEvents] = useState<ScheduleItem[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // Add form
  const [newFields, setNewFields] = useState(BLANK_EVENT);
  const [addingEvent, setAddingEvent] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState(BLANK_EVENT);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setGuests(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as GuestItem)));
      setLoadingGuests(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'schedule'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleItem)));
      setLoadingSchedule(false);
    });
    return unsub;
  }, []);

  async function handlePromote(uid: string) { await updateDoc(doc(db, 'users', uid), { role: 'host' }); }
  async function handleDemote(uid: string) { await updateDoc(doc(db, 'users', uid), { role: 'guest' }); }
  async function handleRemove(uid: string) { await deleteDoc(doc(db, 'users', uid)); }

  async function moveEvent(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= events.length) return;
    const reordered = [...events];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setEvents(reordered);
    const batch = writeBatch(db);
    reordered.forEach((item, i) => batch.update(doc(db, 'schedule', item.id), { order: i }));
    await batch.commit();
  }

  async function handleDeleteEvent(id: string) {
    Alert.alert('Delete event', 'Remove this event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDoc(doc(db, 'schedule', id)) },
    ]);
  }

  async function handleAddEvent() {
    if (!newFields.title.trim() || !newFields.location.trim()) return;
    setAddingEvent(true);
    const startTime = parseTimeToTimestamp(newFields.time, newFields.day);
    await addDoc(collection(db, 'schedule'), {
      title: newFields.title.trim(),
      location: newFields.location.trim(),
      description: newFields.description.trim() || null,
      order: events.length,
      startTime,
      icon: newFields.icon.trim() || '✦',
      color: newFields.color,
      dress: newFields.dress.trim() || null,
      primary: newFields.primary,
    });
    setNewFields(BLANK_EVENT);
    setAddingEvent(false);
  }

  function startEdit(item: ScheduleItem) {
    const { time, day } = formatTimestamp(item.startTime);
    setEditingId(item.id);
    setEditFields({
      title: item.title,
      location: item.location,
      description: item.description ?? '',
      time,
      day,
      icon: item.icon ?? '',
      color: item.color ?? 'accent',
      dress: item.dress ?? '',
      primary: item.primary ?? false,
    });
  }

  async function handleSaveEdit() {
    if (!editingId || !editFields.title.trim() || !editFields.location.trim()) return;
    setSavingEdit(true);
    try {
      const startTime = parseTimeToTimestamp(editFields.time, editFields.day);
      await updateDoc(doc(db, 'schedule', editingId), {
        title: editFields.title.trim(),
        location: editFields.location.trim(),
        description: editFields.description.trim() || null,
        startTime: startTime ?? null,
        icon: editFields.icon.trim() || '✦',
        color: editFields.color,
        dress: editFields.dress.trim() || null,
        primary: editFields.primary,
      });
      setEditingId(null);
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSavingEdit(false);
    }
  }

  const guestCount = guests.filter((g) => g.role === 'guest').length;
  const hostCount = guests.filter((g) => g.role === 'host').length;

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Host Tools</Text>
        <Text style={styles.headerSub}>{guestCount} guests · {hostCount} hosts</Text>
      </View>

      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {(['guests', 'schedule'] as Tab[]).map((t) => (
            <TouchableOpacity key={t} style={[styles.segBtn, tab === t && styles.segBtnActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[styles.segBtnText, tab === t && styles.segBtnTextActive]}>
                {t === 'guests' ? 'Guests' : 'Schedule'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'guests' && (
        loadingGuests ? <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.accent} /> : (
          <FlatList
            data={guests}
            keyExtractor={(g) => g.uid}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <GuestRow uid={item.uid} user={item} onPromote={handlePromote} onDemote={handleDemote} onRemove={handleRemove} />
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No guests yet</Text>}
          />
        )
      )}

      {tab === 'schedule' && (
        loadingSchedule ? <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.accent} /> : (
          <FlatList
            data={events}
            keyExtractor={(e) => e.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={<EventForm fields={newFields} onChange={setNewFields} onSubmit={handleAddEvent} submitting={addingEvent} mode="add" />}
            renderItem={({ item, index }) => {
              if (editingId === item.id) {
                return (
                  <View style={styles.editCard}>
                    <Text style={styles.sectionLabel}>EDIT EVENT</Text>
                    <EventForm
                      fields={editFields}
                      onChange={setEditFields}
                      onSubmit={handleSaveEdit}
                      onCancel={() => setEditingId(null)}
                      submitting={savingEdit}
                      mode="edit"
                    />
                  </View>
                );
              }
              return (
                <View style={styles.eventRow}>
                  <View style={styles.moveButtons}>
                    <TouchableOpacity onPress={() => moveEvent(index, -1)} disabled={index === 0} style={styles.moveBtn}>
                      <Text style={[styles.moveBtnText, index === 0 && styles.moveBtnDisabled]}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveEvent(index, 1)} disabled={index === events.length - 1} style={styles.moveBtn}>
                      <Text style={[styles.moveBtnText, index === events.length - 1 && styles.moveBtnDisabled]}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{item.primary ? '★ ' : ''}{item.title}</Text>
                    <Text style={styles.eventMeta}>
                      {formatTimestamp(item.startTime).time}
                      {item.dress ? ` · ${item.dress}` : ''}
                    </Text>
                    <Text style={styles.eventLocation}>{item.location}</Text>
                  </View>
                  <View style={styles.eventRowActions}>
                    <TouchableOpacity style={styles.editChip} onPress={() => startEdit(item)} activeOpacity={0.7}>
                      <Text style={styles.editChipText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteEvent(item.id)} activeOpacity={0.7}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No schedule events yet</Text>}
          />
        )
      )}
    </ScreenWrapper>
  );
}

// ── Shared event form ─────────────────────────────────────────────────────────

interface EventFields {
  title: string; location: string; description: string;
  time: string; day: string; icon: string;
  color: EventColor; dress: string; primary: boolean;
}

interface FormProps {
  fields: EventFields;
  onChange: (f: EventFields) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitting: boolean;
  mode: 'add' | 'edit';
}

function EventForm({ fields, onChange, onSubmit, onCancel, submitting, mode }: FormProps) {
  const set = (key: keyof EventFields) => (val: any) => onChange({ ...fields, [key]: val });

  return (
    <View style={mode === 'add' ? fStyles.addWrap : fStyles.editWrap}>
      {mode === 'add' && <Text style={fStyles.sectionLabel}>ADD EVENT</Text>}

      <Text style={fStyles.fieldLabel}>TITLE</Text>
      <TextInput style={fStyles.input} value={fields.title} onChangeText={set('title')} placeholder="Event title" placeholderTextColor={theme.colors.ink4} />

      <Text style={fStyles.fieldLabel}>LOCATION</Text>
      <TextInput style={fStyles.input} value={fields.location} onChangeText={set('location')} placeholder="Venue / room" placeholderTextColor={theme.colors.ink4} />

      <View style={fStyles.row}>
        <View style={{ flex: 1 }}>
          <Text style={fStyles.fieldLabel}>TIME</Text>
          <TextInput style={fStyles.input} value={fields.time} onChangeText={set('time')} placeholder="e.g. 7:00 PM" placeholderTextColor={theme.colors.ink4} />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={fStyles.fieldLabel}>DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={fStyles.datePicker}>
            {DATE_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d.value}
                style={[fStyles.dateBubble, fields.day === d.value && fStyles.dateBubbleActive]}
                onPress={() => set('day')(d.value)}
                activeOpacity={0.7}>
                <Text style={[fStyles.dateBubbleText, fields.day === d.value && fStyles.dateBubbleTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={fStyles.row}>
        <View style={{ flex: 1 }}>
          <Text style={fStyles.fieldLabel}>ICON</Text>
          <TextInput style={fStyles.input} value={fields.icon} onChangeText={set('icon')} placeholder="e.g. ✦ or emoji" placeholderTextColor={theme.colors.ink4} />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={fStyles.fieldLabel}>DRESS CODE</Text>
          <TextInput style={fStyles.input} value={fields.dress} onChangeText={set('dress')} placeholder="e.g. Black Tie" placeholderTextColor={theme.colors.ink4} />
        </View>
      </View>

      <Text style={fStyles.fieldLabel}>CARD COLOUR</Text>
      <View style={fStyles.colorRow}>
        {COLOR_OPTIONS.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[fStyles.colorChip, { backgroundColor: c.bg }, fields.color === c.value && fStyles.colorChipActive]}
            onPress={() => set('color')(c.value)}
            activeOpacity={0.7}>
            <Text style={fStyles.colorChipText}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={fStyles.fieldLabel}>DESCRIPTION</Text>
      <TextInput style={[fStyles.input, fStyles.multiline]} value={fields.description} onChangeText={set('description')} placeholder="Optional details" placeholderTextColor={theme.colors.ink4} multiline />

      <View style={fStyles.switchRow}>
        <Text style={fStyles.switchLabel}>Main event</Text>
        <Switch
          value={fields.primary}
          onValueChange={set('primary')}
          trackColor={{ true: theme.colors.accent, false: theme.colors.line }}
          thumbColor={theme.colors.bg}
        />
      </View>

      <View style={fStyles.actions}>
        {onCancel && (
          <TouchableOpacity style={fStyles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={fStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[fStyles.submitBtn, submitting && fStyles.submitBtnDisabled, onCancel ? { flex: 1 } : {}]}
          onPress={onSubmit}
          disabled={submitting}
          activeOpacity={0.85}>
          {submitting
            ? <ActivityIndicator color={theme.colors.bg} size="small" />
            : <Text style={fStyles.submitText}>{mode === 'add' ? 'Add event' : 'Save changes'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const fStyles = StyleSheet.create({
  addWrap: { marginBottom: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderColor: theme.colors.line },
  editWrap: { paddingTop: 4 },
  sectionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 12 },
  fieldLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.ink4, fontFamily: theme.fonts.sans, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.md,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
    color: theme.colors.ink, backgroundColor: theme.colors.card, fontFamily: theme.fonts.sans,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  datePicker: { paddingVertical: 2 },
  dateBubble: {
    width: 52, paddingVertical: 6, borderRadius: theme.radii.sm, marginRight: 6,
    backgroundColor: theme.colors.surface2, alignItems: 'center',
  },
  dateBubbleActive: { backgroundColor: theme.colors.accent },
  dateBubbleText: { fontSize: 10, fontWeight: '600', color: theme.colors.ink3, fontFamily: theme.fonts.sans, textAlign: 'center' },
  dateBubbleTextActive: { color: theme.colors.bg },
  colorRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  colorChip: {
    flex: 1, paddingVertical: 7, borderRadius: theme.radii.sm,
    alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent',
  },
  colorChipActive: { borderColor: theme.colors.accentDeep },
  colorChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.ink2, fontFamily: theme.fonts.sans },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
  switchLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.ink, fontFamily: theme.fonts.sans },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.pill, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: theme.colors.ink3, fontWeight: '600', fontSize: 13, fontFamily: theme.fonts.sans },
  submitBtn: { flex: 2, backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill, paddingVertical: 10, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: theme.colors.accentSoft },
  submitText: { color: theme.colors.bg, fontWeight: '600', fontSize: 13, fontFamily: theme.fonts.sans },
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: theme.colors.ink, fontFamily: theme.fonts.serif },
  headerSub: { fontSize: 12, color: theme.colors.ink3, marginTop: 2, fontFamily: theme.fonts.sans },
  segmentWrap: { paddingHorizontal: 18, marginBottom: 4 },
  segment: { flexDirection: 'row', backgroundColor: theme.colors.surface2, borderRadius: theme.radii.md, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: theme.radii.sm, alignItems: 'center' },
  segBtnActive: { backgroundColor: theme.colors.card, ...theme.shadows.s1 },
  segBtnText: { fontSize: 13, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  segBtnTextActive: { color: theme.colors.ink, fontWeight: '600' },
  listContent: { paddingHorizontal: 18, paddingBottom: 100 },
  empty: { textAlign: 'center', paddingVertical: 32, color: theme.colors.ink3, fontSize: 14, fontFamily: theme.fonts.sans },
  editCard: { marginVertical: 8, padding: 14, backgroundColor: theme.colors.card, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.lineStrong, ...theme.shadows.s1 },
  sectionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.ink3, fontFamily: theme.fonts.sans, marginBottom: 8 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderColor: theme.colors.line, gap: 12 },
  moveButtons: { flexDirection: 'column', alignItems: 'center', gap: 2 },
  moveBtn: { padding: 3 },
  moveBtnText: { fontSize: 12, color: theme.colors.accent, fontWeight: '700' },
  moveBtnDisabled: { color: theme.colors.ink4 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.ink, fontFamily: theme.fonts.sans },
  eventMeta: { fontSize: 11, color: theme.colors.accent, marginTop: 1, fontFamily: theme.fonts.sans },
  eventLocation: { fontSize: 11, color: theme.colors.ink3, marginTop: 1, fontFamily: theme.fonts.sans },
  eventRowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentTint },
  editChipText: { fontSize: 12, color: theme.colors.accentDeep, fontWeight: '600', fontFamily: theme.fonts.sans },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.surface2, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 12, color: theme.colors.ink3 },
});
