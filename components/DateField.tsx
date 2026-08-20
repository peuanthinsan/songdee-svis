import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, borderRadius, modalOverlay } from '../constants/theme';

type DateFieldProps = { label: string; value: string; onChange: (value: string) => void };

const pad = (value: number) => String(value).padStart(2, '0');
const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function DateField({ label, value, onChange }: DateFieldProps) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthLabel = useMemo(() => cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), [cursor]);

  function choose(day: number) {
    onChange(formatDate(new Date(year, month, day)));
    setOpen(false);
  }

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.75} accessibilityRole="button">
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueRow}><Ionicons name="calendar-outline" size={16} color={colors.accent} /><Text style={styles.value}>{value || 'YYYY-MM-DD'}</Text></View>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: modalOverlay }} onPress={() => setOpen(false)}>
          <Pressable style={styles.modal} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}><Text style={styles.title}>{label}</Text><TouchableOpacity onPress={() => setOpen(false)}><Ionicons name="close" size={22} color={colors.textSecondary} /></TouchableOpacity></View>
            <View style={styles.monthRow}><TouchableOpacity style={styles.arrow} onPress={() => setCursor(new Date(year, month - 1, 1))}><Text style={styles.arrowText}>‹</Text></TouchableOpacity><Text style={styles.month}>{monthLabel}</Text><TouchableOpacity style={styles.arrow} onPress={() => setCursor(new Date(year, month + 1, 1))}><Text style={styles.arrowText}>›</Text></TouchableOpacity></View>
            <View style={styles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
            <View style={styles.grid}>{Array.from({ length: firstDay }, (_, index) => <View key={`blank-${index}`} style={styles.day} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const selected = value === formatDate(new Date(year, month, day)); return <TouchableOpacity key={day} style={[styles.day, selected && styles.daySelected]} onPress={() => choose(day)}><Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text></TouchableOpacity>; })}</View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, backgroundColor: colors.cardBackground },
  label: { color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  value: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  modal: { width: '92%', maxWidth: 380, backgroundColor: colors.cardBackground, borderRadius: borderRadius.lg, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  month: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
  arrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, backgroundColor: colors.inputBackground },
  arrowText: { color: colors.textPrimary, fontSize: 26, lineHeight: 28 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { width: '14.285%', textAlign: 'center', color: colors.textTertiary, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.285%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full },
  daySelected: { backgroundColor: colors.accent },
  dayText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  dayTextSelected: { color: colors.onPrimary },
});
