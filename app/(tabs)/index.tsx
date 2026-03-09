import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getTodayDateEST, getTimeUntilCutoff } from '@/lib/dateUtils';
import { useAppConfig } from '@/contexts/ConfigContext';

interface Submission {
  submission_text: string;
  wordle_score: number;
  submitted_at: string;
}

export default function DailySubmissionScreen() {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const [submissionText, setSubmissionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [todaySubmission, setTodaySubmission] = useState<Submission | null>(null);
  const [timeUntilCutoff, setTimeUntilCutoff] = useState('');
  const [isPastCutoff, setIsPastCutoff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTodaySubmission();
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateCountdown = () => {
    const { hours, minutes, seconds, isPastCutoff: pastCutoff } = getTimeUntilCutoff();

    if (pastCutoff) {
      setIsPastCutoff(true);
      setTimeUntilCutoff('Submission window closed');
      return;
    }

    setTimeUntilCutoff(`${hours}h ${minutes}m ${seconds}s until cutoff`);
    setIsPastCutoff(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTodaySubmission();
    setRefreshing(false);
  };

  const loadTodaySubmission = async () => {
    if (!user) return;

    const today = getTodayDateEST();
    const { data, error } = await supabase
      .from('daily_submissions')
      .select('submission_text, wordle_score, submitted_at')
      .eq('user_id', user.id)
      .eq('submission_date', today)
      .maybeSingle();

    if (!error && data) {
      setTodaySubmission(data);
    }
  };

  const parseWordle = (text: string) => {
    const lines = text.trim().split('\n');
    const firstLine = lines[0];
    const match = firstLine.match(/(\d+)\/\d+/);

    if (!match) return null;

    const guesses = parseInt(match[1]);
    return {
      guesses,
      score: guesses === 1 ? 20 : guesses === 2 ? 8 : guesses === 3 ? 6 : guesses === 4 ? 4 : guesses === 5 ? 2 : guesses === 6 ? 1 : -2
    };
  };

  const handleSubmit = async () => {
    if (!submissionText.trim()) {
      setError('Please paste your Wordle result');
      return;
    }

    if (isPastCutoff) {
      setError('Submission window has closed for today');
      return;
    }

    setLoading(true);
    setError('');

    const parsed = parseWordle(submissionText);
    if (!parsed) {
      setError('Invalid Wordle format. Please paste the complete share text.');
      setLoading(false);
      return;
    }

    const today = getTodayDateEST();

    const { data, error: dbError } = await supabase
      .from('daily_submissions')
      .insert([
        {
          user_id: user!.id,
          submission_date: today,
          submission_text: submissionText.trim(),
          wordle_score: parsed.score,
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      setTodaySubmission({
        submission_text: data.submission_text,
        wordle_score: data.wordle_score,
        submitted_at: data.submitted_at,
      });
      setSubmissionText('');
    }
  };

  const renderWordleGrid = (text: string) => {
    const lines = text.split('\n');
    const gridLines = lines.filter(line => /[🟩🟨⬜⬛]/.test(line));

    return (
      <View style={styles.wordleGrid}>
        {gridLines.map((line, index) => (
          <Text key={index} style={styles.wordleRow}>{line}</Text>
        ))}
      </View>
    );
  };

  if (todaySubmission) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Today's Submission</Text>
          <Text style={styles.timer}>{timeUntilCutoff}</Text>
        </View>

        <View style={styles.submittedCard}>
          <Text style={styles.submittedTitle}>Submitted Successfully!</Text>
          <Text style={styles.scoreText}>Score: {todaySubmission.wordle_score} points</Text>

          {renderWordleGrid(todaySubmission.submission_text)}

          <Text style={styles.submittedTime}>
            Submitted at {new Date(todaySubmission.submitted_at).toLocaleTimeString()}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Your score has been applied to all active tournaments you're participating in.
          </Text>
          <Text style={styles.infoText}>
            Come back tomorrow for your next submission!
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Daily Wordle Submission</Text>
        <Text style={styles.timer}>{timeUntilCutoff}</Text>
      </View>

      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>How to submit:</Text>
        <Text style={styles.instructionsText}>1. Play today's Wordle</Text>
        <Text style={styles.instructionsText}>2. Tap the Share button</Text>
        <Text style={styles.instructionsText}>3. Paste the complete result below</Text>
      </View>

      <View style={styles.formCard}>
        <TextInput
          style={styles.textArea}
          placeholder="Paste your Wordle result here..."
          placeholderTextColor="#999"
          value={submissionText}
          onChangeText={setSubmissionText}
          multiline
          numberOfLines={8}
          editable={!loading && !isPastCutoff}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (loading || isPastCutoff) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading || isPastCutoff}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isPastCutoff ? 'Submission Closed' : 'Submit'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.scoringCard}>
        <Text style={styles.scoringTitle}>Scoring System</Text>
        <View style={styles.scoringRow}>
          <Text style={styles.scoringText}>1 guess: {config?.pointsGuess1 ?? 20} points</Text>
          <Text style={styles.scoringText}>2 guesses: {config?.pointsGuess2 ?? 8} points</Text>
        </View>
        <View style={styles.scoringRow}>
          <Text style={styles.scoringText}>3 guesses: {config?.pointsGuess3 ?? 6} points</Text>
          <Text style={styles.scoringText}>4 guesses: {config?.pointsGuess4 ?? 4} points</Text>
        </View>
        <View style={styles.scoringRow}>
          <Text style={styles.scoringText}>5 guesses: {config?.pointsGuess5 ?? 2} points</Text>
          <Text style={styles.scoringText}>6 guesses: {config?.pointsGuess6 ?? 1} points</Text>
        </View>
        <Text style={styles.scoringText}>
          No submission: {config?.pointsMissed ?? -2} points
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#10b981',
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  timer: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  instructionsCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  formCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textArea: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
  },
  scoringCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoringTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  scoringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoringText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  submittedCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  submittedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  wordleGrid: {
    marginVertical: 16,
    alignItems: 'center',
  },
  wordleRow: {
    fontSize: 24,
    marginBottom: 4,
    letterSpacing: 4,
  },
  submittedTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 8,
    textAlign: 'center',
  },
});
