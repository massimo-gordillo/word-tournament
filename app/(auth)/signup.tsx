import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
} from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { AppColors } from '@/constants/colors';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { markPendingSignupIntro } from '@/lib/pendingSignupIntro';
import { LoadingButton } from '@/components/LoadingButton';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { copy, fillCopyTemplate } from '@/app/copy/strings';
import { scrollToEndAfterLayout, showFormError } from '@/lib/keyboardForm';

export default function SignupScreen() {
  const MIN_DISPLAY_NAME_LENGTH = 3;
  const MAX_DISPLAY_NAME_LENGTH = 15;
  const scrollRef = useRef<ScrollView>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!email || !displayName.trim() || !password || !confirmPassword) {
      showFormError(scrollRef, setError, copy.auth.signup.fillAllFieldsError);
      return;
    }

    if (password !== confirmPassword) {
      showFormError(scrollRef, setError, copy.auth.signup.passwordsMismatchError);
      return;
    }

    if (password.length < 6) {
      showFormError(scrollRef, setError, copy.auth.signup.passwordTooShortError);
      return;
    }

    const trimmedDisplayName = displayName.trim();
    if (trimmedDisplayName.length < MIN_DISPLAY_NAME_LENGTH) {
      showFormError(
        scrollRef,
        setError,
        fillCopyTemplate(copy.auth.signup.displayNameMinError, {
          min: MIN_DISPLAY_NAME_LENGTH,
        }),
      );
      return;
    }
    if (trimmedDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
      showFormError(
        scrollRef,
        setError,
        fillCopyTemplate(copy.auth.signup.displayNameMaxError, {
          max: MAX_DISPLAY_NAME_LENGTH,
        }),
      );
      return;
    }

    Keyboard.dismiss();
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
      showFormError(scrollRef, setError, signUpError.message);
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
    <KeyboardAwareScrollView
      ref={scrollRef}
      containerStyle={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.title}>{copy.auth.signup.title}</Text>
      <Text style={styles.subtitle}>{copy.auth.signup.subtitle}</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={copy.auth.signup.emailPlaceholder}
          placeholderTextColor={AppColors.text.placeholder}
          value={email}
          onChangeText={setEmail}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder={copy.auth.signup.displayNamePlaceholder}
          placeholderTextColor={AppColors.text.placeholder}
          value={displayName}
          onChangeText={setDisplayName}
          autoCorrect={false}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          returnKeyType="next"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder={copy.auth.signup.passwordPlaceholder}
          placeholderTextColor={AppColors.text.placeholder}
          value={password}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="next"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder={copy.auth.signup.confirmPasswordPlaceholder}
          placeholderTextColor={AppColors.text.placeholder}
          value={confirmPassword}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setConfirmPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={handleSignup}
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
            {copy.auth.signup.alreadyHavePrefix}{' '}
            <Text style={styles.linkTextBold}>{copy.auth.signup.signInCta}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = createStyles({
  container: {
    flex: 1,
    backgroundColor: AppColors.background.app,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: AppColors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.text.muted,
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: AppColors.background.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: AppColors.text.primary,
    borderWidth: 1,
    borderColor: AppColors.border.light,
  },
  button: {
    backgroundColor: AppColors.brand.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: AppColors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    textAlign: 'center',
    color: AppColors.text.muted,
    fontSize: 14,
    marginTop: 8,
  },
  linkTextDisabled: {
    opacity: 0.5,
  },
  linkTextBold: {
    color: AppColors.brand.primary,
    fontWeight: '600',
  },
  error: {
    color: AppColors.status.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
