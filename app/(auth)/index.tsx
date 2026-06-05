import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { AppleSignInButton } from '@/components/AppleSignInButton';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { copy } from '@/app/copy/strings';
import { showFormError } from '@/lib/keyboardForm';

type ActiveSignInMethod = 'email' | 'apple' | null;

export default function LoginScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeSignIn, setActiveSignIn] = useState<ActiveSignInMethod>(null);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const signInInProgress = activeSignIn !== null;

  const handleLogin = async () => {
    if (signInInProgress) {
      return;
    }

    if (!email || !password) {
      showFormError(scrollRef, setError, copy.auth.login.fillAllFieldsError);
      return;
    }

    setActiveSignIn('email');
    setError('');

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setPassword('');
      showFormError(scrollRef, setError, signInError.message);
      setActiveSignIn(null);
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <>
      <KeyboardAwareScrollView
        ref={scrollRef}
        containerStyle={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>{copy.auth.login.title}</Text>
        <Text style={styles.subtitle}>{copy.auth.login.subtitle}</Text>

        <AppleSignInButton
          disabled={signInInProgress}
          onSignInStart={() => setActiveSignIn('apple')}
          onSignInEnd={() => setActiveSignIn(null)}
        />

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={copy.auth.login.emailPlaceholder}
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            editable={!signInInProgress}
          />

          <TextInput
            style={styles.input}
            placeholder={copy.auth.login.passwordPlaceholder}
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
            textContentType="password"
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            editable={!signInInProgress}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, signInInProgress && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={signInInProgress}
          >
            {activeSignIn === 'email' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{copy.auth.login.signInButton}</Text>
            )}
          </TouchableOpacity>

          {/* Forgot password — re-enable when email reset is configured
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            disabled={signInInProgress}
          >
            <Text style={styles.linkText}>
              <Text style={styles.linkTextBold}>{copy.auth.login.forgotPassword}</Text>
            </Text>
          </TouchableOpacity>
          */}

          <TouchableOpacity
            onPress={() => router.push('/(auth)/signup')}
            disabled={signInInProgress}
          >
            <Text style={[styles.linkText, signInInProgress && styles.linkTextDisabled]}>
              {copy.auth.login.noAccountPrefix}{' '}
              <Text style={styles.linkTextBold}>{copy.auth.login.signUpCta}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

      <Modal
        visible={activeSignIn === 'apple'}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" color="#10b981" style={styles.modalSpinner} />
            <Text style={styles.modalTitle}>{copy.auth.login.appleSigningInTitle}</Text>
            <Text style={styles.modalMessage}>{copy.auth.login.appleSigningInMessage}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = createStyles({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  modalSpinner: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});
