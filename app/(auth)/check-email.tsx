import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { AppColors } from '@/constants/colors';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { copy } from '@/app/copy/strings';

type Variant = 'signup' | 'recovery';

export default function CheckEmailScreen() {
  const { email: emailParam, variant: variantParam } = useLocalSearchParams<{
    email?: string;
    variant?: string;
  }>();
  const email = typeof emailParam === 'string' ? emailParam : '';
  const variant: Variant = variantParam === 'recovery' ? 'recovery' : 'signup';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      setError(copy.auth.checkEmail.missingEmail);
      return;
    }

    setLoading(true);
    setError('');
    setSent(false);

    if (variant === 'signup') {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: Linking.createURL('(tabs)'),
        },
      });

      if (resendError) {
        setError(resendError.message);
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
      return;
    }

    const redirectTo = Linking.createURL('/reset-password');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  const title =
    variant === 'signup' ? copy.auth.checkEmail.titleSignup : copy.auth.checkEmail.titleRecovery;
  const body =
    variant === 'signup' ? copy.auth.checkEmail.bodySignup : copy.auth.checkEmail.bodyRecovery;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{body}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {sent ? <Text style={styles.sent}>{copy.auth.checkEmail.messageSent}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleResend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={AppColors.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>{copy.auth.checkEmail.resendButton}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)')} disabled={loading}>
          <Text style={[styles.linkText, loading && styles.linkTextDisabled]}>
            {copy.auth.checkEmail.backPrefix}{' '}
            <Text style={styles.linkTextBold}>{copy.auth.checkEmail.signInBold}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = createStyles({
  container: {
    flex: 1,
    backgroundColor: AppColors.background.app,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppColors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.text.muted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  email: {
    fontSize: 15,
    color: AppColors.text.primary,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
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
    marginTop: 24,
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
    marginBottom: 8,
  },
  sent: {
    color: AppColors.status.successDark,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
});
