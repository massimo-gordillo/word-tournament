import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { copy } from '@/app/copy/strings';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSessionReady(!!data.session);
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSessionReady(!!session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      setError(copy.auth.resetPassword.fillAllFieldsError);
      return;
    }

    if (password !== confirmPassword) {
      setError(copy.auth.resetPassword.passwordsMismatchError);
      return;
    }

    if (password.length < 6) {
      setError(copy.auth.resetPassword.passwordTooShortError);
      return;
    }

    setLoading(true);
    setError('');

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setPassword('');
      setConfirmPassword('');
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.replace('/(tabs)');
  };

  if (!sessionReady) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.title}>{copy.auth.resetPassword.waitingTitle}</Text>
        <Text style={styles.subtitle}>{copy.auth.resetPassword.waitingSubtitle}</Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/forgot-password')}>
          <Text style={styles.linkTextBold}>{copy.auth.resetPassword.forgotPasswordLink}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => router.replace('/(auth)')}>
          <Text style={styles.linkText}>{copy.auth.resetPassword.backToSignIn}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{copy.auth.resetPassword.chooseTitle}</Text>
        <Text style={styles.subtitle}>{copy.auth.resetPassword.chooseSubtitle}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={copy.auth.resetPassword.newPasswordPlaceholder}
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder={copy.auth.resetPassword.confirmPlaceholder}
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!loading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{copy.auth.resetPassword.updateButton}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 16,
  },
  linkTextBold: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  secondary: {
    marginTop: 24,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
});
