import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { markPendingSignupIntro } from '@/lib/pendingSignupIntro';
import { LoadingButton } from '@/components/LoadingButton';
import { copy, fillCopyTemplate } from '@/app/copy/strings';

export default function SignupScreen() {
  const MIN_DISPLAY_NAME_LENGTH = 4;
  const MAX_DISPLAY_NAME_LENGTH = 15;
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pendingIntroKey = 'wt_pending_signup_intro';

  const handleSignup = async () => {
    if (!email || !displayName.trim() || !password || !confirmPassword) {
      setError(copy.auth.signup.fillAllFieldsError);
      return;
    }

    if (password !== confirmPassword) {
      setError(copy.auth.signup.passwordsMismatchError);
      return;
    }

    if (password.length < 6) {
      setError(copy.auth.signup.passwordTooShortError);
      return;
    }

    const trimmedDisplayName = displayName.trim();
    if (trimmedDisplayName.length < MIN_DISPLAY_NAME_LENGTH) {
      setError(
        fillCopyTemplate(copy.auth.signup.displayNameMinError, {
          min: MIN_DISPLAY_NAME_LENGTH,
        }),
      );
      return;
    }
    if (trimmedDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
      setError(
        fillCopyTemplate(copy.auth.signup.displayNameMaxError, {
          max: MAX_DISPLAY_NAME_LENGTH,
        }),
      );
      return;
    }

    setLoading(true);
    setError('');
    const emailRedirectTo = Linking.createURL('(tabs)');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { display_name: trimmedDisplayName },
      },
    });

    if (signUpError) {
      setPassword('');
      setConfirmPassword('');
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    await markPendingSignupIntro();

    if (!data.user) {
      setLoading(false);
      router.replace({
        pathname: '/(auth)/check-email',
        params: { email, variant: 'signup' },
      });
      return;
    }

    setLoading(false);

    if (data.session) {
      router.replace({
        pathname: '/(tabs)',
        params: { showIntro: '1' },
      });
      return;
    }

    router.replace({
      pathname: '/(auth)/check-email',
      params: { email, variant: 'signup' },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{copy.auth.signup.title}</Text>
        <Text style={styles.subtitle}>{copy.auth.signup.subtitle}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={copy.auth.signup.emailPlaceholder}
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder={copy.auth.signup.displayNamePlaceholder}
            placeholderTextColor="#999"
            value={displayName}
            onChangeText={setDisplayName}
            autoCorrect={false}
            autoCapitalize="words"
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder={copy.auth.signup.passwordPlaceholder}
            placeholderTextColor="#999"
            value={password}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder={copy.auth.signup.confirmPasswordPlaceholder}
            placeholderTextColor="#999"
            value={confirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!loading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <LoadingButton
            style={styles.button}
            onPress={handleSignup}
            loading={loading}
          >
            <Text style={styles.buttonText}>{copy.auth.signup.createButton}</Text>
          </LoadingButton>

          <TouchableOpacity onPress={() => router.back()} disabled={loading}>
            <Text style={[styles.linkText, loading && styles.linkTextDisabled]}>
              {copy.auth.signup.alreadyHavePrefix} <Text style={styles.linkTextBold}>{copy.auth.signup.signInCta}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = createStyles({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  linkTextDisabled: {
    opacity: 0.5,
  },
  linkTextBold: {
    color: '#10b981',
    fontWeight: '600',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
});
