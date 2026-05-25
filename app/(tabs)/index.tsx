import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { clearPendingSignupIntro, getPendingSignupIntro } from '@/lib/pendingSignupIntro';
import { getTodayDateEST, getTimeUntilCutoff } from '@/lib/dateUtils';
import { useAppConfig } from '@/contexts/ConfigContext';
import { DailySubmissionCard } from '@/components/DailySubmissionCard';
import { devLog } from '@/utils/logger';
import { copy } from '@/app/copy/strings';
import { withTimeout } from '@/lib/requestTimeout';

interface Submission {
  submission_text: string;
  wordle_score: number;
  submitted_at: string;
}

const NO_SUBMISSION_PENALTY_LABEL = 'NO SUBMISSION - PENALTY';
const TODAY_SUBMISSION_TIMEOUT_MS = 12000;

/** Placeholder for tournament_chat.message when message_type is result (grid lives on daily_submissions). */
const RESULT_CHAT_PLACEHOLDER_MESSAGE = 'result';
const PENDING_SIGNUP_INTRO_KEY = 'wt_pending_signup_intro';

export default function DailySubmissionScreen() {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();
  const { showIntro } = useLocalSearchParams<{ showIntro?: string }>();
  const [submissionText, setSubmissionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [todaySubmission, setTodaySubmission] = useState<Submission | null>(null);
  const [timeUntilCutoff, setTimeUntilCutoff] = useState('');
  const [isPastCutoff, setIsPastCutoff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [initialSubmissionLoadComplete, setInitialSubmissionLoadComplete] = useState(false);
  const [loadError, setLoadError] = useState('');

  const dismissIntroModal = useCallback(() => {
    setShowIntroModal(false);
    void clearPendingSignupIntro();
  }, []);

  const loadTodaySubmission = useCallback(async () => {
    if (!user) return;
    setLoadError('');
    try {
      const today = getTodayDateEST();
      const { data, error } = await withTimeout(
        supabase
          .from('daily_submissions')
          .select('submission_text, wordle_score, submitted_at')
          .eq('user_id', user.id)
          .eq('submission_date', today)
          .maybeSingle(),
        TODAY_SUBMISSION_TIMEOUT_MS,
        'Loading today\'s submission timed out',
      );

      if (error) {
        setLoadError('Could not load your submission right now. Please try again.');
        setTodaySubmission(null);
        return;
      }
      if (!data) {
        setTodaySubmission(null);
        return;
      }
      if (data.submission_text === NO_SUBMISSION_PENALTY_LABEL) {
        setTodaySubmission(null);
        return;
      }
      setTodaySubmission(data);
    } catch (err) {
      devLog('loadTodaySubmission failed', err);
      setLoadError('Unable to reach the server. Please try again.');
      setTodaySubmission(null);
    } finally {
      setInitialSubmissionLoadComplete(true);
    }
  }, [user]);

  const updateCountdown = useCallback(() => {
    const cutoffHour = config?.cutoffHourEst ?? 23;
    const { hours, minutes, isPastCutoff: pastCutoff } = getTimeUntilCutoff(cutoffHour);

    if (pastCutoff) {
      setIsPastCutoff(true);
      setTimeUntilCutoff(copy.dailySubmission.closedWindow);
      return;
    }

    setTimeUntilCutoff(`${hours}h ${minutes}m ${copy.dailySubmission.cutoffCountdownSuffix}`);
    setIsPastCutoff(false);
  }, [config?.cutoffHourEst]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  useEffect(() => {
    if (!user) {
      setTodaySubmission(null);
      setInitialSubmissionLoadComplete(true);
      setLoadError('');
      return;
    }
    setTodaySubmission(null);
    setInitialSubmissionLoadComplete(false);
    void loadTodaySubmission();
  }, [user, loadTodaySubmission]);

  // Route param + AsyncStorage flag (Android/iOS/web). Clear storage only on dismiss.
  useLayoutEffect(() => {
    const fromParam = showIntro === '1';
    if (fromParam) {
      setShowIntroModal(true);
      router.replace('/(tabs)');
    }

    let cancelled = false;
    void (async () => {
      const fromStorage = await getPendingSignupIntro();
      if (cancelled) return;
      if (fromStorage) {
        setShowIntroModal(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showIntro, router]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTodaySubmission();
    setRefreshing(false);
  };

  const parseWordle = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const lines = trimmed.split('\n');
    const emojiLines = lines.filter(line => /[🟩🟨⬜⬛]/.test(line));

    const rowCount = emojiLines.length;
    const maxRows = config?.maxSubmissionRows ?? 6;
    const hasEmojiRows = rowCount > 0;
    if (!hasEmojiRows) {
      devLog('parseWord: no emoji rows found', { text });
      return null;
    }

    if (rowCount > maxRows) {
      devLog('parseWord: too many rows', { rowCount, maxRows });
      return null;
    }

    // Total number of square emojis across all rows
    let totalSquares = 0;
    let rowShapeValid = true;
    const normalizedRows: string[] = [];
    for (const line of emojiLines) {
      const onlySquares = line.replace(/[^🟩🟨⬜⬛]/g, '');
      // Count logical squares by mapping each emoji to a single ASCII char (B/Y/G),
      // since emoji are multi-code-unit in JS string length.
      let rowChars = '';
      for (const ch of onlySquares) {
        if (ch === '🟩') {
          rowChars += 'G';
        } else if (ch === '🟨') {
          rowChars += 'Y';
        } else {
          // ⬛ or ⬜ -> B
          rowChars += 'B';
        }
      }

      const visibleSquares = rowChars.length;
      totalSquares += visibleSquares;

      // Each row must be exactly 5 squares after normalization
      if (visibleSquares !== 5) {
        rowShapeValid = false;
        devLog('parseWord: invalid row shape (normalized length)', {
          line,
          onlySquares,
          rowChars,
          visibleSquares,
        });
        return null;
      }

      normalizedRows.push(rowChars);
    }

    // Total squares must be a multiple of 5 and at least 5
    const squaresMultipleOfFive = totalSquares >= 5 && totalSquares % 5 === 0;
    if (!squaresMultipleOfFive) {
      devLog('parseWord: total squares invalid', { totalSquares });
      return null;
    }

    // Use normalized chars for final-row validation
    const lastRowChars = normalizedRows[normalizedRows.length - 1];
    const allGreen = lastRowChars === 'GGGGG';

    const normalizedGrid = normalizedRows.join('\n');

    // If maxRows rows and final row is not all green, treat as failure
    if (rowCount === maxRows && !allGreen) {
      devLog('parseWord: max rows, final row not all green -> score -2', {
        rowCount,
        lastRowChars,
        normalizedGrid,
      });
      return { guesses: rowCount, score: -2, normalizedGrid };
    }

    // For fewer than 6 rows, final row must be all green
    if (rowCount < 6 && !allGreen) {
      devLog('parseWord: <6 rows and final row not all green', {
        rowCount,
        lastRowChars,
      });
      return null;
    }

    const guesses = rowCount;
    const score =
      guesses === 1
        ? 20
        : guesses === 2
        ? 8
        : guesses === 3
        ? 6
        : guesses === 4
        ? 4
        : guesses === 5
        ? 2
        : guesses === 6
        ? 1
        : -2;

    const debugInfo = {
      rowCount,
      totalSquares,
      hasEmojiRows,
      rowShapeValid,
      squaresMultipleOfFive,
      lastRowChars,
      allGreen,
      guesses,
      score,
      normalizedGrid,
    };
    devLog('parseWord: parsed successfully', debugInfo);

    return { guesses, score, normalizedGrid };
  };

  const insertResultChatForTournaments = async (
    userId: string,
    submissionDate: string,
    dailySubmissionId: string,
  ) => {
    const { data: memberships, error: memErr } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', userId);

    if (memErr) {
      devLog('insertResultChatForTournaments: participants query failed', memErr);
      return;
    }

    const tournamentIds = [...new Set(memberships?.map(m => m.tournament_id) ?? [])];
    if (tournamentIds.length === 0) return;

    const { data: openTournaments, error: tourErr } = await supabase
      .from('tournaments')
      .select('id')
      .in('id', tournamentIds)
      .in('status', ['active', 'closed']);

    if (tourErr) {
      devLog('insertResultChatForTournaments: tournaments query failed', tourErr);
      return;
    }

    const rows =
      openTournaments?.map(t => ({
        tournament_id: t.id,
        user_id: userId,
        message: RESULT_CHAT_PLACEHOLDER_MESSAGE,
        message_type: 'result' as const,
        submission_date: submissionDate,
        daily_submission_id: dailySubmissionId,
      })) ?? [];

    if (rows.length === 0) return;

    const { error: chatErr } = await supabase.from('tournament_chat').insert(rows);
    if (chatErr) {
      devLog('insertResultChatForTournaments: chat insert failed', chatErr);
    }
  };

  const handleSubmit = async () => {
    if (!submissionText.trim()) {
      setError(copy.dailySubmission.emptySubmissionError);
      return;
    }

    if (isPastCutoff) {
      setError(copy.dailySubmission.pastCutoffError);
      return;
    }

    setLoading(true);
    setError('');

    const parsed = parseWordle(submissionText);
    if (!parsed) {
      setError(copy.dailySubmission.invalidGridError);
      setLoading(false);
      return;
    }

    if (!parsed.normalizedGrid) {
      devLog('parseWord: missing normalizedGrid on parsed result', parsed);
      setError(copy.dailySubmission.parseFailedError);
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
          // store normalized char grid (B/Y/G) instead of raw emojis
          submission_text: parsed.normalizedGrid,
          wordle_score: parsed.score,
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (dbError) {
      const message = dbError.message || copy.dailySubmission.dbSaveFallbackError;
      devLog('handleSubmit: backend error', { message, dbError });
      if (message.toLowerCase().includes('invalid word grid')) {
        setError(copy.dailySubmission.dbInvalidGridError);
      } else {
        setError(message);
      }
    } else {
      devLog('handleSubmit: submission saved', { data });
      await insertResultChatForTournaments(user!.id, today, data.id);
      setTodaySubmission({
        submission_text: data.submission_text,
        wordle_score: data.wordle_score,
        submitted_at: data.submitted_at,
      });
      setSubmissionText('');
    }
  };

  const introModal = (
    <Modal
      visible={showIntroModal}
      transparent
      animationType="fade"
      onRequestClose={dismissIntroModal}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{copy.dailySubmission.introModal.title}</Text>
          <Text style={styles.modalBodyTitle}>{copy.dailySubmission.introModal.submitSectionTitle}</Text>
          <Text style={styles.modalBodyText}>{copy.dailySubmission.introModal.submitStep1}</Text>
          <Text style={styles.modalBodyText}>{copy.dailySubmission.introModal.submitStep2}</Text>
          <Text style={styles.modalBodyText}>{copy.dailySubmission.introModal.submitStep3}</Text>

          <Text style={styles.modalBodyTitle}>{copy.dailySubmission.introModal.createSectionTitle}</Text>
          <Text style={styles.modalBodyText}>{copy.dailySubmission.introModal.createStep1}</Text>
          <Text style={styles.modalBodyText}>{copy.dailySubmission.introModal.createStep2}</Text>
          <Text style={styles.modalBodyText}>{copy.dailySubmission.introModal.createStep3}</Text>

          <Text style={styles.modalBodyTitle}>{copy.dailySubmission.introModal.joinSectionTitle}</Text>
          <Text style={styles.modalBodyText}>{copy.dailySubmission.introModal.joinStep1}</Text>
          <Text style={styles.modalBodyText}>{copy.dailySubmission.introModal.joinStep2}</Text>
          <Text style={styles.modalBodyText}>{copy.dailySubmission.introModal.joinStep3}</Text>

          <TouchableOpacity style={styles.modalButton} onPress={dismissIntroModal}>
            <Text style={styles.modalButtonText}>{copy.dailySubmission.introModal.dismissButton}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (!initialSubmissionLoadComplete) {
    return (
      <>
        {introModal}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      </>
    );
  }

  if (todaySubmission) {
    return (
      <>
        {introModal}
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>{copy.dailySubmission.todaySubmissionTitle}</Text>
            <Text style={styles.timer}>{timeUntilCutoff}</Text>
          </View>
          {loadError ? (
            <View style={styles.loadErrorCard}>
              <Text style={styles.error}>{loadError}</Text>
            </View>
          ) : null}

          <DailySubmissionCard
            dateLabel={copy.dailySubmission.todayDateLabel}
            didSubmit
            score={todaySubmission.wordle_score}
            submissionText={todaySubmission.submission_text}
          />

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              {copy.dailySubmission.scoreAppliedInfo}
            </Text>
            <Text style={styles.infoText}>
              {copy.dailySubmission.nextSubmissionInfo}
            </Text>
          </View>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      {introModal}
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>{copy.dailySubmission.formTitle}</Text>
          <Text style={styles.timer}>{timeUntilCutoff}</Text>
        </View>

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>{copy.dailySubmission.instructionsTitle}</Text>
          <Text style={styles.instructionsText}>{copy.dailySubmission.instruction1}</Text>
          <Text style={styles.instructionsText}>{copy.dailySubmission.instruction2}</Text>
          <Text style={styles.instructionsText}>{copy.dailySubmission.instruction3}</Text>
        </View>

        <View style={styles.formCard}>
          {loadError ? (
            <View style={styles.loadErrorCard}>
              <Text style={styles.error}>{loadError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setInitialSubmissionLoadComplete(false);
                  void loadTodaySubmission();
                }}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <TextInput
            style={styles.textArea}
            placeholder={isPastCutoff ? copy.dailySubmission.closedInputPlaceholder : copy.dailySubmission.openInputPlaceholder}
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
                {isPastCutoff ? copy.dailySubmission.closedSubmitButton : copy.dailySubmission.submitButton}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/*<View style={styles.scoringCard}>
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
        </View>*/}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  modalBodyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 8,
    marginBottom: 6,
  },
  modalBodyText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  modalButton: {
    marginTop: 16,
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#10b981',
    padding: 24,
    paddingTop: 40,
    paddingBottom: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 0,
  },
  timer: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  instructionsCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
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
  loadErrorCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
