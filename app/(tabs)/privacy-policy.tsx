import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { AppColors } from '@/constants/colors';

const PRIVACY_POLICY_URL = 'https://massimo-gordillo.github.io/word-tournament/privacy-policy';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  const handleOpenPolicy = async () => {
    if (opening) return;

    setOpening(true);
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/account')}
          disabled={opening}
        >
          <ChevronLeft size={18} color={AppColors.text.inverse} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.paragraph}>
            Your privacy policy should describe what data is collected, how it is used, and how users can contact you about their data.
          </Text>
          <Text style={styles.paragraph}>
            Update the URL in this screen once your final hosted policy is available.
          </Text>
          <Text style={styles.urlLabel}>{PRIVACY_POLICY_URL}</Text>

          <TouchableOpacity
            style={[styles.button, opening && styles.buttonDisabled]}
            onPress={handleOpenPolicy}
            disabled={opening}
          >
            {opening ? (
              <ActivityIndicator color={AppColors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Open Privacy Policy</Text>
            )}
          </TouchableOpacity>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: AppColors.text.inverse,
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: AppColors.background.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paragraph: {
    fontSize: 14,
    color: AppColors.text.secondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  urlLabel: {
    fontSize: 14,
    color: AppColors.text.strong,
    fontWeight: '600',
    marginBottom: 16,
  },
  button: {
    backgroundColor: AppColors.brand.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: AppColors.text.inverse,
    fontSize: 15,
    fontWeight: '600',
  },
});
