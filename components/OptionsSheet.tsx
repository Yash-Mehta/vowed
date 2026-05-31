import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

export interface SheetOption {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  options: SheetOption[];
  onClose: () => void;
}

export function OptionsSheet({ visible, options, onClose }: Props) {
  const insets = useSafeAreaInsets();

  function pick(opt: SheetOption) {
    onClose();
    opt.onPress?.();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          {options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.row, i > 0 && styles.rowBorder]}
              onPress={() => pick(opt)}
              activeOpacity={0.65}>
              <Text style={[styles.label, opt.destructive && styles.destructiveLabel]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.cancelGap} />
          <TouchableOpacity style={styles.cancelRow} onPress={onClose} activeOpacity={0.65}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    ...theme.shadows.s3,
  },
  row: { paddingVertical: 16, paddingHorizontal: 24 },
  rowBorder: { borderTopWidth: 0.5, borderColor: theme.colors.line },
  label: { fontSize: 16, color: theme.colors.ink, fontFamily: theme.fonts.sans, textAlign: 'center' },
  destructiveLabel: { color: '#C0392B' },
  cancelGap: { height: 8, backgroundColor: theme.colors.surface2 },
  cancelRow: { paddingVertical: 16, paddingHorizontal: 24 },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.ink,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
  },
});
