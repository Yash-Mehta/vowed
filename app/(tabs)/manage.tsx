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
  Image,
  Modal,
  Platform,
  Share,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { db, storage } from '../../lib/firebase';
import { UserDoc, membersCol, scheduleCol } from '../../lib/firestore';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../store/authStore';
import { useWeddingStore } from '../../store/weddingStore';
import { configFromDoc } from '../../lib/weddingConfig';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { GuestRow } from '../../components/GuestRow';
import { theme } from '../../constants/theme';

type Tab = 'guests' | 'schedule' | 'settings';
type EventColor = 'sky' | 'leaf' | 'accent' | 'sand';

const COLOR_OPTIONS: { value: EventColor; label: string; bg: string }[] = [
  { value: 'accent', label: 'Rose',  bg: theme.colors.accentTint },
  { value: 'sky',    label: 'Sky',   bg: '#E8F1F4' },
  { value: 'leaf',   label: 'Leaf',  bg: '#E8EFE0' },
  { value: 'sand',   label: 'Sand',  bg: '#F4ECDC' },
];

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayLabel(iso: string): string {
  if (!iso) return 'Select date';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDayShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

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

function parseTimeToTimestamp(timeStr: string, dateISO: string): Timestamp | null {
  const clean = timeStr.trim().toLowerCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match || !dateISO) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  const d = new Date(`${dateISO}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

function formatTimestamp(ts: any): { time: string; day: string } {
  if (!ts?.toDate) return { time: '', day: '' };
  const d: Date = ts.toDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const time = `${h}:${String(minutes).padStart(2, '0')} ${period}`;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`;
  return { time, day };
}

const BLANK_EVENT = {
  title: '', location: '', description: '', time: '', day: '',
  icon: '', color: 'accent' as EventColor, dress: '', primary: false,
};

function GuestRegistryView() {
  const { config } = useWeddingStore();

  if (config?.registryUrl) {
    return (
      <ScreenWrapper>
        <View style={gStyles.container}>
          <Text style={gStyles.icon}>🎁</Text>
          <Text style={gStyles.title}>Gift Registry</Text>
          <Text style={gStyles.subtitle}>
            The couple has put together a wishlist just for you.
          </Text>
          <TouchableOpacity
            style={gStyles.btn}
            onPress={() => WebBrowser.openBrowserAsync(config.registryUrl!)}
            activeOpacity={0.85}>
            <Text style={gStyles.btnText}>View Registry</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={gStyles.container}>
        <Text style={gStyles.title}>Registry coming soon</Text>
        <Text style={gStyles.subtitle}>
          The couple hasn't added their registry yet — check back closer to the big day!
        </Text>
      </View>
    </ScreenWrapper>
  );
}

const gStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  icon: { fontSize: 52, marginBottom: 16 },
  title: {
    fontSize: 24,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink3,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  btn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  btnText: {
    color: theme.colors.bg,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: theme.fonts.sans,
  },
});

export default function ManageScreen() {
  const [tab, setTab] = useState<Tab>('guests');
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [events, setEvents] = useState<ScheduleItem[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const { weddingId, firebaseUser, role } = useAuthStore();
  const { config } = useWeddingStore();

  // Add form
  const [newFields, setNewFields] = useState(BLANK_EVENT);
  const [addingEvent, setAddingEvent] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState(BLANK_EVENT);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!weddingId) return;
    const unsub = onSnapshot(membersCol(weddingId), (snap) => {
      setGuests(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as GuestItem)));
      setLoadingGuests(false);
    }, (err) => { if (err.code !== 'permission-denied') console.warn(err); });
    return unsub;
  }, [weddingId]);

  useEffect(() => {
    if (!weddingId) return;
    const q = query(scheduleCol(weddingId), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleItem)));
      setLoadingSchedule(false);
    }, (err) => { if (err.code !== 'permission-denied') console.warn(err); });
    return unsub;
  }, [weddingId]);

  if (role !== 'host') return <GuestRegistryView />;

  async function handlePromote(uid: string) {
    if (!weddingId) return;
    try {
      await updateDoc(doc(db, 'weddings', weddingId, 'members', uid), { role: 'host' });
    } catch {
      Alert.alert('Error', 'Could not promote guest.');
    }
  }
  async function handleDemote(uid: string) {
    if (!weddingId) return;
    try {
      await updateDoc(doc(db, 'weddings', weddingId, 'members', uid), { role: 'guest' });
    } catch {
      Alert.alert('Error', 'Could not update role.');
    }
  }
  async function handleRemove(uid: string) {
    if (!weddingId) return;
    try {
      await deleteDoc(doc(db, 'weddings', weddingId, 'members', uid));
    } catch {
      Alert.alert('Error', 'Could not remove guest.');
    }
  }

  async function moveEvent(index: number, direction: -1 | 1) {
    if (!weddingId) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= events.length) return;
    const reordered = [...events];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setEvents(reordered);
    const batch = writeBatch(db);
    reordered.forEach((item, i) =>
      batch.update(doc(db, 'weddings', weddingId, 'schedule', item.id), { order: i })
    );
    try {
      await batch.commit();
    } catch {
      setEvents(events); // revert optimistic update on failure
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!weddingId) return;
    Alert.alert('Delete event', 'Remove this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteDoc(doc(db, 'weddings', weddingId, 'schedule', id)).catch(() =>
            Alert.alert('Error', 'Could not delete event.')
          ),
      },
    ]);
  }

  async function handleAddEvent() {
    if (!weddingId || !newFields.title.trim() || !newFields.location.trim()) return;
    setAddingEvent(true);
    try {
      const startTime = parseTimeToTimestamp(newFields.time, newFields.day);
      const newRef = doc(collection(db, 'weddings', weddingId, 'schedule'));
      const newData = {
        title: newFields.title.trim(),
        location: newFields.location.trim(),
        description: newFields.description.trim() || null,
        startTime,
        icon: newFields.icon.trim() || '✦',
        color: newFields.color,
        dress: newFields.dress.trim() || null,
        primary: newFields.primary,
      };
      const merged = [...events, { id: newRef.id, ...newData, order: 0 }];
      merged.sort((a, b) => {
        const at = a.startTime?.toDate?.()?.getTime() ?? Infinity;
        const bt = b.startTime?.toDate?.()?.getTime() ?? Infinity;
        return at - bt;
      });
      const batch = writeBatch(db);
      merged.forEach((item, i) => {
        if (item.id === newRef.id) {
          batch.set(newRef, { ...newData, order: i });
        } else {
          batch.update(doc(db, 'weddings', weddingId, 'schedule', item.id), { order: i });
        }
      });
      await batch.commit();
      setNewFields(BLANK_EVENT);
    } catch {
      Alert.alert('Error', 'Could not add event.');
    } finally {
      setAddingEvent(false);
    }
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
    if (!weddingId || !editingId || !editFields.title.trim() || !editFields.location.trim()) return;
    setSavingEdit(true);
    try {
      const startTime = parseTimeToTimestamp(editFields.time, editFields.day);
      await updateDoc(doc(db, 'weddings', weddingId, 'schedule', editingId), {
        title: editFields.title.trim(),
        location: editFields.location.trim(),
        description: editFields.description.trim() || null,
        startTime: startTime ?? null,
        icon: editFields.icon.trim() || '✦',
        color: editFields.color,
        dress: editFields.dress.trim() || null,
        primary: editFields.primary,
      });
      const updated = events.map((e) =>
        e.id === editingId ? { ...e, startTime: startTime ?? null } : e
      );
      updated.sort((a, b) => {
        const at = a.startTime?.toDate?.()?.getTime() ?? Infinity;
        const bt = b.startTime?.toDate?.()?.getTime() ?? Infinity;
        return at - bt;
      });
      const reorderBatch = writeBatch(db);
      updated.forEach((item, i) =>
        reorderBatch.update(doc(db, 'weddings', weddingId, 'schedule', item.id), { order: i })
      );
      await reorderBatch.commit();
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
          {(['guests', 'schedule', 'settings'] as Tab[]).map((t) => (
            <TouchableOpacity key={t} style={[styles.segBtn, tab === t && styles.segBtnActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[styles.segBtnText, tab === t && styles.segBtnTextActive]}>
                {t === 'guests' ? 'Guests' : t === 'schedule' ? 'Schedule' : 'Settings'}
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
              <GuestRow uid={item.uid} user={item} currentUid={firebaseUser?.uid} onPromote={handlePromote} onDemote={handleDemote} onRemove={handleRemove} />
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No guests yet</Text>}
          />
        )
      )}

      {tab === 'settings' && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <WeddingDetailsEditor weddingId={weddingId} config={config} />
          <InviteCodes config={config} />
          <LogoSettings weddingId={weddingId} config={config} />
        </ScrollView>
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
                      {(() => {
                        const { time, day } = formatTimestamp(item.startTime);
                        return [time, day ? formatDayShort(day) : null, item.dress || null].filter(Boolean).join(' · ');
                      })()}
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

// ── Wedding Details Editor ────────────────────────────────────────────────────

function WeddingDetailsEditor({ weddingId, config }: { weddingId: string | null; config: any }) {
  const [person1, setPerson1] = useState(config?.person1First ?? '');
  const [person2, setPerson2] = useState(config?.person2First ?? '');
  const [venue, setVenue] = useState(config?.venue ?? '');
  const [venueShort, setVenueShort] = useState(config?.venueShort ?? '');
  const [location, setLocation] = useState(config?.location ?? '');
  const [hashtag, setHashtag] = useState(config?.hashtag ?? '');
  const [registryUrl, setRegistryUrl] = useState(config?.registryUrl ?? '');
  const [weddingDate, setWeddingDate] = useState<Date>(
    config?.weddingDate instanceof Date ? config.weddingDate : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [ceremonyTime, setCeremonyTime] = useState(
    config?.weddingDate instanceof Date ? dateToTimeString(config.weddingDate) : ''
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  function deriveDateFields(d: Date) {
    const y = d.getFullYear();
    const mo = d.getMonth();
    const day = d.getDate();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const weddingDateISO = `${y}-${String(mo + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dateStamp = `${months[mo]} ${day}, ${y}`;
    const displayDate = `${weekdays[d.getDay()]}, ${day} ${months[mo]} ${y}`;
    const shortDate = `${shortMonths[mo]} ${day}`;
    return { weddingDateISO, dateStamp, displayDate, shortDate };
  }

  function onDateChange(_: any, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setWeddingDate(date);
  }

  function onTimeChange(_: any, date?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) setCeremonyTime(dateToTimeString(date));
  }

  async function handleSave() {
    if (!weddingId) return;
    setSaving(true);
    try {
      const p1 = person1.trim();
      const p2 = person2.trim();
      const coupleName = p1 && p2 ? `${p1} & ${p2}` : config?.coupleName ?? '';
      const dateFields = deriveDateFields(weddingDate);
      const combined = new Date(weddingDate);
      if (ceremonyTime) {
        const t = timeStringToDate(ceremonyTime);
        combined.setHours(t.getHours(), t.getMinutes(), 0, 0);
      } else {
        combined.setHours(12, 0, 0, 0);
      }
      const updatedFields: Record<string, any> = {
        person1First: p1,
        person2First: p2,
        coupleName,
        coupleNameFull: coupleName,
        monogramInitials: p1 && p2 ? `${p1[0]}${p2[0]}` : config?.monogramInitials ?? '',
        venue: venue.trim(),
        venueShort: venueShort.trim() || venue.trim(),
        location: location.trim(),
        hashtag: hashtag.trim(),
        registryUrl: registryUrl.trim() || null,
        weddingDateTimeUTC: combined.toISOString(),
        ...dateFields,
      };
      await updateDoc(doc(db, 'weddings', weddingId), updatedFields);
      // Update weddingsByCode preview docs
      const preview = { coupleName, dateStamp: dateFields.dateStamp, venue: venue.trim(), monogramInitials: config?.monogramInitials ?? '' };
      const guestCode = config?.guestInviteCode;
      const hostCode = config?.hostInviteCode;
      if (guestCode) await updateDoc(doc(db, 'weddingsByCode', guestCode), { preview }).catch(() => {});
      if (hostCode) await updateDoc(doc(db, 'weddingsByCode', hostCode), { preview }).catch(() => {});
      // Refresh store
      useWeddingStore.getState().setConfig(configFromDoc({ ...config, ...updatedFields, weddingId }));
      Alert.alert('Saved', 'Wedding details updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  const dateLabel = weddingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <View style={dStyles.container}>
      <Text style={lStyles.sectionHead}>WEDDING DETAILS</Text>

      <Text style={dStyles.fieldLabel}>COUPLE NAMES</Text>
      <View style={dStyles.row}>
        <TextInput
          style={[dStyles.input, { flex: 1 }]}
          value={person1}
          onChangeText={setPerson1}
          placeholder="Person 1"
          placeholderTextColor={theme.colors.ink4}
        />
        <View style={{ width: 10 }} />
        <TextInput
          style={[dStyles.input, { flex: 1 }]}
          value={person2}
          onChangeText={setPerson2}
          placeholder="Person 2"
          placeholderTextColor={theme.colors.ink4}
        />
      </View>

      <Text style={dStyles.fieldLabel}>WEDDING DATE</Text>
      <TouchableOpacity style={[dStyles.input, dStyles.dateBtn]} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
        <Text style={dStyles.dateBtnText}>{dateLabel}</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker value={weddingDate} mode="date" display="default" onChange={onDateChange} />
      )}
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal visible transparent animationType="slide">
          <View style={fStyles.pickerOverlay}>
            <View style={fStyles.pickerSheet}>
              <View style={fStyles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={fStyles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={weddingDate} mode="date" display="spinner" onChange={onDateChange} textColor={theme.colors.ink} style={{ height: 180 }} />
            </View>
          </View>
        </Modal>
      )}

      <Text style={dStyles.fieldLabel}>CEREMONY TIME</Text>
      <TouchableOpacity style={[dStyles.input, dStyles.dateBtn]} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
        <Text style={[dStyles.dateBtnText, !ceremonyTime && { color: theme.colors.ink4 }]}>
          {ceremonyTime || 'Select time'}
        </Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker value={timeStringToDate(ceremonyTime)} mode="time" display="default" onChange={onTimeChange} />
      )}
      {Platform.OS === 'ios' && showTimePicker && (
        <Modal visible transparent animationType="slide">
          <View style={fStyles.pickerOverlay}>
            <View style={fStyles.pickerSheet}>
              <View style={fStyles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={fStyles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={timeStringToDate(ceremonyTime)} mode="time" display="spinner" onChange={onTimeChange} textColor={theme.colors.ink} style={{ height: 180 }} />
            </View>
          </View>
        </Modal>
      )}

      <Text style={dStyles.fieldLabel}>VENUE</Text>
      <TextInput style={dStyles.input} value={venue} onChangeText={setVenue} placeholder="Full venue name" placeholderTextColor={theme.colors.ink4} />

      <Text style={dStyles.fieldLabel}>SHORT VENUE NAME</Text>
      <TextInput style={dStyles.input} value={venueShort} onChangeText={setVenueShort} placeholder="e.g. Hard Rock Punta Cana" placeholderTextColor={theme.colors.ink4} />

      <Text style={dStyles.fieldLabel}>LOCATION</Text>
      <TextInput style={dStyles.input} value={location} onChangeText={setLocation} placeholder="City, Country" placeholderTextColor={theme.colors.ink4} />

      <Text style={dStyles.fieldLabel}>HASHTAG</Text>
      <TextInput style={dStyles.input} value={hashtag} onChangeText={setHashtag} placeholder="#OurWedding" placeholderTextColor={theme.colors.ink4} autoCapitalize="none" />

      <Text style={dStyles.fieldLabel}>REGISTRY URL</Text>
      <TextInput style={dStyles.input} value={registryUrl} onChangeText={setRegistryUrl} placeholder="https://..." placeholderTextColor={theme.colors.ink4} autoCapitalize="none" keyboardType="url" />

      <TouchableOpacity
        style={[dStyles.saveBtn, saving && dStyles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}>
        {saving
          ? <ActivityIndicator color={theme.colors.bg} size="small" />
          : <Text style={dStyles.saveBtnText}>Save changes</Text>}
      </TouchableOpacity>
    </View>
  );
}

const dStyles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 8, borderBottomWidth: 0.5, borderColor: theme.colors.line },
  fieldLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.ink4, fontFamily: theme.fonts.sans, marginBottom: 4, marginTop: 10 },
  row: { flexDirection: 'row' },
  input: {
    borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.md,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
    color: theme.colors.ink, backgroundColor: theme.colors.card, fontFamily: theme.fonts.sans,
  },
  dateBtn: { justifyContent: 'center' },
  dateBtnText: { fontSize: 14, color: theme.colors.ink, fontFamily: theme.fonts.sans },
  saveBtn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: theme.colors.bg, fontSize: 15, fontWeight: '600', fontFamily: theme.fonts.sans },
});

// ── Invite Codes ─────────────────────────────────────────────────────────────

function InviteCodes({ config }: { config: any }) {
  const guestCode: string = config?.guestInviteCode ?? '—';
  const hostCode: string = config?.hostInviteCode ?? '—';

  async function handleShare(code: string) {
    try {
      await Share.share({ message: code });
    } catch {}
  }

  return (
    <View style={icStyles.container}>
      <Text style={lStyles.sectionHead}>INVITE CODES</Text>

      <View style={icStyles.row}>
        <View style={icStyles.labelWrap}>
          <Text style={dStyles.fieldLabel}>GUEST CODE</Text>
          <Text style={icStyles.code}>{guestCode}</Text>
        </View>
        <TouchableOpacity style={icStyles.shareBtn} onPress={() => handleShare(guestCode)} activeOpacity={0.7}>
          <Text style={icStyles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={icStyles.row}>
        <View style={icStyles.labelWrap}>
          <Text style={dStyles.fieldLabel}>HOST CODE</Text>
          <Text style={icStyles.code}>{hostCode}</Text>
        </View>
        <TouchableOpacity style={icStyles.shareBtn} onPress={() => handleShare(hostCode)} activeOpacity={0.7}>
          <Text style={icStyles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const icStyles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 16, borderBottomWidth: 0.5, borderColor: theme.colors.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  labelWrap: { flex: 1 },
  code: { fontSize: 15, fontFamily: theme.fonts.sans, color: theme.colors.ink, fontWeight: '600', marginTop: 2 },
  shareBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: theme.radii.pill,
    borderWidth: 1, borderColor: theme.colors.accent,
    marginLeft: 12,
  },
  shareBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.accent, fontFamily: theme.fonts.sans },
});

// ── Danger Zone ───────────────────────────────────────────────────────────────

// ── Logo / monogram settings ──────────────────────────────────────────────────

function LogoSettings({ weddingId, config }: { weddingId: string | null; config: any }) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const coverPhotoURL: string | null = config?.coverPhotoURL ?? null;
  const monogramInitials: string = config?.monogramInitials ?? '??';

  async function handleUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0] || !weddingId) return;

    setUploading(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const response = await fetch(manipulated.uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `weddings/${weddingId}/coverPhoto.jpg`);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'weddings', weddingId), { coverPhotoURL: downloadURL });
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!weddingId) return;
    Alert.alert('Remove logo', 'This will revert to your initials monogram.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          try {
            await updateDoc(doc(db, 'weddings', weddingId), { coverPhotoURL: null });
            try {
              await deleteObject(ref(storage, `weddings/${weddingId}/coverPhoto.jpg`));
            } catch {}
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={lStyles.container}>
      <Text style={lStyles.sectionHead}>WEDDING LOGO</Text>
      <Text style={lStyles.hint}>
        Shown in the feed header for all guests. Upload your own photo or we'll use your initials.
      </Text>

      <View style={lStyles.previewWrap}>
        {coverPhotoURL ? (
          <Image source={{ uri: coverPhotoURL }} style={lStyles.previewPhoto} />
        ) : (
          <View style={lStyles.previewMonogram}>
            <Text style={lStyles.monogramText}>{monogramInitials}</Text>
          </View>
        )}
        <Text style={lStyles.previewLabel}>
          {coverPhotoURL ? 'Current logo' : 'Default monogram'}
        </Text>
      </View>

      <TouchableOpacity
        style={[lStyles.uploadBtn, uploading && lStyles.btnDisabled]}
        onPress={handleUpload}
        disabled={uploading}
        activeOpacity={0.85}>
        {uploading
          ? <ActivityIndicator color={theme.colors.bg} size="small" />
          : <Text style={lStyles.uploadBtnText}>{coverPhotoURL ? 'Change photo' : 'Upload photo'}</Text>}
      </TouchableOpacity>

      {coverPhotoURL && (
        <TouchableOpacity
          style={[lStyles.removeBtn, removing && lStyles.btnDisabled]}
          onPress={handleRemove}
          disabled={removing}
          activeOpacity={0.85}>
          {removing
            ? <ActivityIndicator color={theme.colors.accent} size="small" />
            : <Text style={lStyles.removeBtnText}>Remove photo</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const lStyles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 8, borderBottomWidth: 0.5, borderColor: theme.colors.line },
  sectionHead: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: theme.colors.accentDeep, fontFamily: theme.fonts.sans, marginBottom: 6,
  },
  hint: { fontSize: 13, color: theme.colors.ink3, fontFamily: theme.fonts.sans, lineHeight: 18, marginBottom: 28 },
  previewWrap: { alignItems: 'center', marginBottom: 28 },
  previewPhoto: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  previewMonogram: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1, borderColor: theme.colors.line,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  monogramText: {
    fontSize: 32, fontFamily: theme.fonts.serif, fontWeight: '600',
    color: theme.colors.accentDeep, letterSpacing: 2,
  },
  previewLabel: { fontSize: 12, color: theme.colors.ink3, fontFamily: theme.fonts.sans },
  uploadBtn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  removeBtn: {
    borderWidth: 1, borderColor: theme.colors.accent, borderRadius: theme.radii.pill,
    paddingVertical: 14, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  uploadBtnText: { color: theme.colors.bg, fontSize: 15, fontWeight: '600', fontFamily: theme.fonts.sans },
  removeBtnText: { color: theme.colors.accent, fontSize: 15, fontWeight: '600', fontFamily: theme.fonts.sans },
});

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

function timeStringToDate(timeStr: string): Date {
  const d = new Date();
  const clean = timeStr.trim().toLowerCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (match[3] === 'pm' && hours < 12) hours += 12;
    if (match[3] === 'am' && hours === 12) hours = 0;
    d.setHours(hours, minutes, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

function dateToTimeString(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, '0')} ${period}`;
}

function EventForm({ fields, onChange, onSubmit, onCancel, submitting, mode }: FormProps) {
  const set = (key: keyof EventFields) => (val: any) => onChange({ ...fields, [key]: val });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const pickerDate = fields.day ? new Date(fields.day + 'T12:00:00') : new Date();
  const pickerTime = timeStringToDate(fields.time);

  function onDateChange(_: any, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) set('day')(isoFromDate(date));
  }

  function onTimeChange(_: any, date?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) set('time')(dateToTimeString(date));
  }

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
          <TouchableOpacity
            style={[fStyles.input, fStyles.dateBtn]}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.7}>
            <Text style={[fStyles.dateBtnText, !fields.time && { color: theme.colors.ink4 }]}>
              {fields.time || 'Select time'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={fStyles.fieldLabel}>DATE</Text>
          <TouchableOpacity
            style={[fStyles.input, fStyles.dateBtn]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}>
            <Text style={[fStyles.dateBtnText, !fields.day && { color: theme.colors.ink4 }]}>
              {formatDayLabel(fields.day)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker value={pickerDate} mode="date" display="default" onChange={onDateChange} />
      )}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker value={pickerTime} mode="time" display="default" onChange={onTimeChange} />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={showDatePicker} transparent animationType="slide">
          <View style={fStyles.pickerOverlay}>
            <View style={fStyles.pickerSheet}>
              <View style={fStyles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={fStyles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                textColor={theme.colors.ink}
                style={{ height: 180 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={showTimePicker} transparent animationType="slide">
          <View style={fStyles.pickerOverlay}>
            <View style={fStyles.pickerSheet}>
              <View style={fStyles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={fStyles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerTime}
                mode="time"
                display="spinner"
                onChange={onTimeChange}
                textColor={theme.colors.ink}
                style={{ height: 180 }}
              />
            </View>
          </View>
        </Modal>
      )}

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
  dateBtn: { justifyContent: 'center' },
  dateBtnText: { fontSize: 14, color: theme.colors.ink, fontFamily: theme.fonts.sans },
  pickerOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerSheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 0.5, borderColor: theme.colors.line,
  },
  pickerDone: { fontSize: 16, fontWeight: '600', color: theme.colors.accent, fontFamily: theme.fonts.sans },
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
