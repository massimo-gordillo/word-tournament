import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, FileText, LogOut, Save, Scale } from 'lucide-react-native';
import { AppColors } from '@/constants/colors';
import { copy, fillCopyTemplate } from '@/app/copy/strings';

export default function AccountScreen() {
  const MIN_DISPLAY_NAME_LENGTH = 4;
  const MAX_DISPLAY_NAME_LENGTH = 15;
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    setDisplayName(data.display_name);
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) {
      setError(copy.account.emptyDisplayName);
      return;
    }
    if (displayName.trim().length < MIN_DISPLAY_NAME_LENGTH) {
      setError(
        fillCopyTemplate(copy.account.displayNameMinError, { min: MIN_DISPLAY_NAME_LENGTH }),
      );
      return;
    }
    if (displayName.trim().length > MAX_DISPLAY_NAME_LENGTH) {
      setError(
        fillCopyTemplate(copy.account.displayNameMaxError, { max: MAX_DISPLAY_NAME_LENGTH }),
      );
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const { error: updateError } = await supabase
      .from('users')
      .update({ display_name: displayName.trim() })
      .eq('id', user!.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(copy.account.successUpdated);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUserProfile();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{copy.account.title}</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.section}>
        <Text style={styles.sectionTitle}>{copy.account.emailSection}</Text>

        <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.account.profileSection}</Text>

          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>{copy.account.displayNameLabel}</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={copy.account.placeholder}
              placeholderTextColor={AppColors.text.subtle}
              editable={!saving}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={handleUpdateProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={AppColors.text.inverse} />
              ) : (
                <>
                  <Save size={20} color={AppColors.text.inverse} />
                  <Text style={styles.buttonText}>{copy.account.saveChanges}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.account.sectionActions}</Text>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <LogOut size={20} color={AppColors.status.error} />
            <Text style={styles.signOutText}>{copy.account.signOut}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.account.appInfoSection}</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{copy.account.versionLabel}</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{copy.account.userIdLabel}</Text>
              <Text style={styles.infoValue}>{user?.id.substring(0, 8)}...</Text>
            </View>
          </View>

          <View style={styles.linkCard}>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push('/(tabs)/open-source-licenses')}
            >
              <View style={styles.linkRowLeft}>
                <Scale size={18} color={AppColors.icon.default} />
                <Text style={styles.linkLabel}>Open Source Licenses</Text>
              </View>
              <ChevronRight size={18} color={AppColors.icon.subtle} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push('/(tabs)/privacy-policy')}
            >
              <View style={styles.linkRowLeft}>
                <FileText size={18} color={AppColors.icon.default} />
                <Text style={styles.linkLabel}>Privacy Policy</Text>
              </View>
              <ChevronRight size={18} color={AppColors.icon.subtle} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background.app,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: AppColors.brand.primary,
    padding: 24,
    paddingTop: 40,
    paddingBottom: 20,
    
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppColors.text.inverse,
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: AppColors.background.surface,
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  email: {
    fontSize: 16,
    color: AppColors.text.muted,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: AppColors.text.primary,
    marginBottom: 16,
  },
  formCard: {
    backgroundColor: AppColors.background.surface,
    padding: 20,
    borderRadius: 12,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 14,
    color: AppColors.text.muted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: AppColors.background.input,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: AppColors.border.default,
    marginBottom: 16,
  },
  button: {
    backgroundColor: AppColors.brand.primary,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: AppColors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: AppColors.status.error,
    fontSize: 14,
    marginBottom: 12,
  },
  success: {
    color: AppColors.status.success,
    fontSize: 14,
    marginBottom: 12,
  },
  signOutButton: {
    backgroundColor: AppColors.background.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AppColors.border.danger,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutText: {
    color: AppColors.status.error,
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: AppColors.background.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border.subtle,
  },
  infoLabel: {
    fontSize: 14,
    color: AppColors.text.muted,
  },
  infoValue: {
    fontSize: 14,
    color: AppColors.text.primary,
    fontWeight: '500',
  },
  linkCard: {
    marginTop: 12,
    backgroundColor: AppColors.background.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border.subtle,
  },
  linkRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkLabel: {
    fontSize: 15,
    color: AppColors.text.secondary,
    fontWeight: '500',
  },
});
