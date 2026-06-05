import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { AppColors } from '@/constants/colors';

const RUNTIME_DEPENDENCIES = [
  '@expo/vector-icons',
  '@lucide/lab',
  '@react-native-async-storage/async-storage',
  '@react-navigation/bottom-tabs',
  '@react-navigation/native',
  '@supabase/supabase-js',
  'expo and Expo SDK modules',
  'lucide-react-native',
  'react',
  'react-dom',
  'react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-svg',
  'react-native-url-polyfill',
  'react-native-web',
  'react-native-webview',
];

export default function OpenSourceLicensesScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/account')}
        >
          <ChevronLeft size={18} color={AppColors.text.inverse} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Open Source Licenses</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.paragraph}>
            This app uses third-party open source libraries distributed under permissive licenses, including MIT and ISC.
          </Text>
          <Text style={styles.paragraph}>
            Full license text and copyright notices are provided in the project notice file:
          </Text>
          <Text style={styles.noticePath}>THIRD_PARTY_NOTICES.md</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Included Libraries</Text>
          {RUNTIME_DEPENDENCIES.map((dependency) => (
            <Text key={dependency} style={styles.listItem}>
              • {dependency}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createStyles({
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
    marginBottom: 12,
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
    marginBottom: 8,
  },
  noticePath: {
    fontSize: 14,
    color: AppColors.text.strong,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text.strong,
    marginBottom: 10,
  },
  listItem: {
    fontSize: 14,
    color: AppColors.text.secondary,
    lineHeight: 22,
  },
});
