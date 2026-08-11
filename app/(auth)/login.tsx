import { useAuth } from '../../lib/auth-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';
import { useI18n } from '../../lib/i18n-context';
import { API_BASE } from '../../lib/api';
import type { Company } from '../../lib/types';

const DEFAULT_COMPANIES: Company[] = [{
  slug: 'dhl',
  name: 'DHL Express',
  shortName: 'DHL',
  primaryColor: '#FFCC00',
  accentColor: '#D40511',
}];

function nameToUsername(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

type LoginMode = 'driver' | 'staff';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<LoginMode>('driver');
  const [selectedName, setSelectedName] = useState('');
  const [selectedStaffName, setSelectedStaffName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [staffNames, setStaffNames] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [companies, setCompanies] = useState<Company[]>(DEFAULT_COMPANIES);
  const [selectedCompanySlug, setSelectedCompanySlug] = useState('dhl');

  useEffect(() => {
    fetch(`${API_BASE}/api/companies`)
      .then(r => r.json())
      .then(data => {
        if (data.companies?.length) {
          setCompanies(data.companies);
          setSelectedCompanySlug(data.defaultCompanySlug || data.companies[0].slug);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedName(''); setSelectedStaffName(''); setUsername(''); setSearch('');
    fetch(`${API_BASE}/api/auth/users-list?company=${encodeURIComponent(selectedCompanySlug)}`)
      .then((r) => r.json())
      .then((data) => { setDriverNames(data.drivers || []); setStaffNames(data.staff || []); })
      .catch(() => { setDriverNames([]); setStaffNames([]); });
  }, [selectedCompanySlug]);

  const nameList = mode === 'driver' ? driverNames : staffNames;
  const currentName = mode === 'driver' ? selectedName : selectedStaffName;
  const filteredNames = nameList.filter((name) => name.toLowerCase().includes(search.toLowerCase()));
  const identifier = currentName ? nameToUsername(currentName) : username.trim();

  const canSubmit = !loading && password.length > 0 && identifier.length > 0;

  async function handleSignIn() {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await signIn(identifier, password, selectedCompanySlug);
      // Auth context handles navigation via AuthGate
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid') || msg.includes('credentials') || msg.includes('password')) {
        setError(t('login.invalidCredentials'));
      } else {
        setError(t('login.networkError'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCard}>
            <Image
              source={require('../../assets/songdee-vis-logo.jpg')}
              style={styles.logoImage}
              contentFit="contain"
            />
          </View>
          <Text style={styles.subtitle}>Songdee Vehicle Inspection System</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>{t('login.company')}</Text>
          <TouchableOpacity
            style={styles.companySelector}
            onPress={() => setShowCompanyPicker(true)}
            activeOpacity={0.75}
          >
            <View style={styles.companyAvatar}>
              <Text style={styles.companyAvatarText}>
                {(companies.find(c => c.slug === selectedCompanySlug)?.shortName || 'DHL').slice(0, 3)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.companyName}>
                {companies.find(c => c.slug === selectedCompanySlug)?.name || 'DHL Express'}
              </Text>
              <Text style={styles.companyHint}>SVIS workspace</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.form}>
            <View style={styles.modeToggle}>
              <TouchableOpacity style={[styles.modeBtn, mode === 'driver' && styles.modeBtnActive]} onPress={() => { setMode('driver'); setError(''); }}>
                <Text style={[styles.modeBtnText, mode === 'driver' && styles.modeBtnTextActive]}>{t('login.driverMode')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, mode === 'staff' && styles.modeBtnActive]} onPress={() => { setMode('staff'); setError(''); }}>
                <Text style={[styles.modeBtnText, mode === 'staff' && styles.modeBtnTextActive]}>{t('login.staffMode')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TouchableOpacity style={styles.pickerInner} onPress={() => setShowPicker(true)}>
                <Text style={[styles.pickerText, !currentName && styles.pickerPlaceholder]}>{currentName || (mode === 'driver' ? t('login.selectDriver') : t('login.selectStaff'))}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingRight: 0 }]}
                  placeholder={t('login.password')}
                  placeholderTextColor={colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: spacing.sm }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>{t('login.submit')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.poweredBy}>
          <Text style={styles.poweredByText}>Powered by</Text>
          <Image
            source={require('../../assets/songdee-logo.png')}
            style={styles.poweredByLogo}
            contentFit="contain"
          />
        </View>
      </View>

      <Modal visible={showPicker} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.userModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{mode === 'driver' ? t('login.selectDriver') : t('login.selectStaff')}</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.modalCloseBtn}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <TextInput style={styles.searchInput} placeholder={t('login.searchDriver')} value={search} onChangeText={setSearch} />
            <FlatList
              data={filteredNames}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyUserText}>{t('login.searchDriver')}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.userOption} onPress={() => { if (mode === 'driver') setSelectedName(item); else setSelectedStaffName(item); setUsername(''); setShowPicker(false); setSearch(''); }}>
                  <Text style={styles.userOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.manualUserButton} onPress={() => { setUsername(''); setShowPicker(false); }}>
              <Text style={styles.manualUserText}>{t('login.username')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCompanyPicker} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.companyModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('login.selectCompany')}</Text>
              <TouchableOpacity onPress={() => setShowCompanyPicker(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {companies.map(company => (
              <TouchableOpacity
                key={company.slug}
                style={[
                  styles.companyOption,
                  company.slug === selectedCompanySlug && styles.companyOptionSelected,
                ]}
                onPress={() => {
                  setSelectedCompanySlug(company.slug);
                  setShowCompanyPicker(false);
                }}
              >
                <View style={[styles.companyAvatar, { backgroundColor: company.primaryColor }]}>
                  <Text style={styles.companyAvatarText}>{company.shortName.slice(0, 3)}</Text>
                </View>
                <Text style={styles.companyName}>{company.name}</Text>
                {company.slug === selectedCompanySlug && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoCard: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  logoImage: {
    width: 188,
    height: 82,
  },
  subtitle: {
    fontSize: 12,
    color: colors.white,
    marginTop: spacing.xs,
    opacity: 0.82,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  companySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginBottom: 12,
    padding: spacing.sm,
  },
  companyAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    height: 34,
    justifyContent: 'center',
    width: 42,
  },
  companyAvatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  companyName: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  companyHint: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  form: {
    gap: 10,
  },
  modeToggle: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modeBtnActive: { borderBottomColor: colors.accent },
  modeBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: colors.accent },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickerInner: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  pickerText: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  pickerPlaceholder: { color: colors.textTertiary },
  error: {
    color: colors.statusFail,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  companyModal: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    margin: spacing.lg,
    overflow: 'hidden',
  },
  userModal: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    margin: spacing.lg,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  searchInput: {
    margin: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userOption: { borderBottomWidth: 1, borderBottomColor: colors.border, padding: spacing.md },
  userOptionText: { color: colors.textPrimary, fontSize: 15 },
  emptyUserText: { color: colors.textTertiary, padding: spacing.lg, textAlign: 'center' },
  manualUserButton: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
  manualUserText: { color: colors.accent, fontWeight: '700', textAlign: 'center' },
  companyOption: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  companyOptionSelected: {
    backgroundColor: colors.accent + '12',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  poweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    opacity: 0.85,
  },
  poweredByText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '500',
  },
  poweredByLogo: {
    width: 100,
    height: 28,
  },
});
