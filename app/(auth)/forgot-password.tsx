import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { AppColors } from '@/constants/colors';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { copy } from '@/app/copy/strings';
import { showFormError } from '@/lib/keyboardForm';

export default function ForgotPasswordScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email) {
      showFormError(scrollRef, setError, copy.auth.forgotPassword.enterEmailError);
      return;
    }

    setLoading(true);
    setError('');

    const redirectTo = Linking.createURL('/reset-password');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      showFormError(scrollRef, setError, resetError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.replace({
      pathname: '/(auth)/check-email',
      params: { email, variant: 'recovery' },
    });
  };

  return (
    <KeyboardAwareScrollView
      ref={scrollRef}
      containerStyle={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.title}>{copy.auth.forgotPassword.title}</Text>
      <Text style={styles.subtitle}>{copy.auth.forgotPassword.subtitle}</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={copy.auth.forgotPassword.emailPlaceholder}
          placeholderTextColor={AppColors.text.placeholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={AppColors.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>{copy.auth.forgotPassword.sendButton}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Text style={[styles.linkText, loading && styles.linkTextDisabled]}>
            <Text style={styles.linkTextBold}>{copy.auth.forgotPassword.backToSignIn}</Text>
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
  buttonDisabled: {
    opacity: 0.6,
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
