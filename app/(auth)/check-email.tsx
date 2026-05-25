import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{copy.auth.checkEmail.resendButton}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)')} disabled={loading}>
          <Text style={styles.linkText}>
            {copy.auth.checkEmail.backPrefix}{' '}
            <Text style={styles.linkTextBold}>{copy.auth.checkEmail.signInBold}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  email: {
    fontSize: 15,
    color: '#1a1a1a',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
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
    marginTop: 24,
  },
  linkTextBold: {
    color: '#10b981',
    fontWeight: '600',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  sent: {
    color: '#059669',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
});
