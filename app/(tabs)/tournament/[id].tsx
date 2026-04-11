import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/ConfigContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Trophy } from 'lucide-react-native';
import {
  getTodayDateEST,
  getYesterdayDateEST,
  getDateInEST,
  formatDateShort,
} from '@/lib/dateUtils';
import { DailySubmissionCard } from '@/components/DailySubmissionCard';
import {
  TournamentChatSection,
  type TournamentChatMessage,
} from '@/components/TournamentChatSection';
import { devLog } from '@/utils/logger';

const NO_SUBMISSION_PENALTY_LABEL = 'NO SUBMISSION - PENALTY';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  join_code: string;
}

interface Score {
  user_id: string;
  total_score: number;
  display_name: string;
  forfeited: boolean;
}

interface Submission {
  user_id: string;
  submission_text: string;
  wordle_score: number;
  display_name: string;
  submission_date: string;
}

export default function TournamentDetailScreen() {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const { id } = useLocalSearchParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [todaySubmissions, setTodaySubmissions] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [participants, setParticipants] = useState<
    { user_id: string; display_name: string; forfeited: boolean; forfeited_at_date: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [resultsReady, setResultsReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [forfeitLoading, setForfeitLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<TournamentChatMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTournamentData();
    }, [id])
  );


  const loadTournamentData = async () => {
    if (!id) return;

    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (tournamentData) {
      if (tournamentData.status === 'draft') {
        router.replace(`/draft-tournament/${id}`);
        return;
      }
      setTournament(tournamentData);
    }

    const { data: allParticipants } = await supabase
      .from('tournament_participants')
      .select('user_id, forfeited, forfeited_at_date')
      .eq('tournament_id', id);

    if (allParticipants) {
      const participantIds = allParticipants.map(p => p.user_id);

      const { data: usersData } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', participantIds);

      const usersMap = new Map(usersData?.map(u => [u.id, u.display_name]));
      const forfeitedMap = new Map(allParticipants.map(p => [p.user_id, p.forfeited]));

      const participantDetails = allParticipants.map(p => ({
        user_id: p.user_id,
        display_name: usersMap.get(p.user_id) || 'Unknown',
        forfeited: forfeitedMap.get(p.user_id) || false,
        forfeited_at_date: p.forfeited_at_date ?? null,
      }));

      setParticipants(participantDetails);

      // All submissions for this tournament window
      const { data: allSubmissionsData } = await supabase
        .from('daily_submissions')
        .select('user_id, submission_text, wordle_score, submission_date')
        .in('user_id', participantIds)
        .gte('submission_date', tournamentData.start_date)
        .lte('submission_date', tournamentData.end_date);

      const allSubmissionsWithNames: Submission[] =
        allSubmissionsData?.map(s => ({
          ...s,
          display_name: usersMap.get(s.user_id) || 'Unknown',
        })) ?? [];

      setAllSubmissions(allSubmissionsWithNames);

      // Today's submissions (from allSubmissions)
      const today = getTodayDateEST();
      const todaySubmissionsData = allSubmissionsWithNames.filter(
        s => s.submission_date === today,
      );

      // "Submitted" for readiness purposes includes penalty rows inserted at cutoff.
      const submittedUserIds = todaySubmissionsData.map(s => s.user_id);
      // Exclude forfeited players: results unlock when all active participants have submitted (or at 11 PM EST)
      const activeParticipantIds = allParticipants
        .filter(p => !forfeitedMap.get(p.user_id))
        .map(p => p.user_id);
      const allActiveSubmitted =
        activeParticipantIds.length === 0
          ? false
          : activeParticipantIds.every(uid => submittedUserIds.includes(uid));

      const estNow = getDateInEST();
      const cutoffHour = config?.cutoffHourEst ?? 23;
      const isPastCutoff = estNow.getHours() >= cutoffHour;

      const ready = allActiveSubmitted || isPastCutoff;
      setResultsReady(ready);

      setTodaySubmissions(todaySubmissionsData);

      // Leaderboard: use submissions up to yesterday or today depending on readiness
      const baseCutoff = ready ? getTodayDateEST() : getYesterdayDateEST();
      const cutoffDate =
        baseCutoff < tournamentData.end_date ? baseCutoff : tournamentData.end_date;

      const totals = new Map<string, number>();
      const submissionScoreByUserAndDay = new Map<string, number>();

      allSubmissionsWithNames
        .filter(
          s =>
            s.submission_date >= tournamentData.start_date &&
            s.submission_date <= cutoffDate,
        )
        .forEach(s => {
          submissionScoreByUserAndDay.set(
            `${s.user_id}:${s.submission_date}`,
            s.wordle_score,
          );
        });

      const addOneDay = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + 1);
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      participantDetails.forEach(p => {
        let total = 0;
        let day = tournamentData.start_date;

        while (day <= cutoffDate) {
          const isForfeitPenaltyDay =
            p.forfeited &&
            p.forfeited_at_date != null &&
            day >= p.forfeited_at_date;

          if (isForfeitPenaltyDay) {
            // Once forfeited, this tournament always uses -2 from forfeiture day onward.
            total += -2;
          } else {
            const scoreForDay = submissionScoreByUserAndDay.get(`${p.user_id}:${day}`);
            if (typeof scoreForDay === 'number') {
              total += scoreForDay;
            }
          }

          day = addOneDay(day);
        }

        totals.set(p.user_id, total);
      });

      const formattedScores = participantDetails
        .map(p => ({
          user_id: p.user_id,
          // Always use the summed total score (including any -2 penalties);
          // forfeited players are still visually marked as forfeited.
          total_score: totals.get(p.user_id) || 0,
          display_name: p.display_name,
          forfeited: p.forfeited,
        }))
        .sort((a, b) => {
          if (a.forfeited && !b.forfeited) return 1;
          if (!a.forfeited && b.forfeited) return -1;
          return b.total_score - a.total_score;
        });

      setScores(formattedScores);
    }

    if (tournamentData && tournamentData.status !== 'draft') {
      const { data: chatData, error: chatErr } = await supabase
        .from('tournament_chat')
        .select(
          'id, user_id, message, message_type, submission_date, created_at, daily_submission_id, users(display_name), daily_submissions!tournament_chat_daily_submission_id_fkey(submission_text, wordle_score)',
        )
        .eq('tournament_id', id)
        .order('created_at', { ascending: true });

      if (chatErr) {
        devLog('tournament chat load failed', chatErr);
        setChatMessages([]);
      } else {
        setChatMessages(
          (chatData ?? []).map(row => {
            const u = row.users as
              | { display_name: string }
              | { display_name: string }[]
              | null
              | undefined;
            const profile = Array.isArray(u) ? u[0] : u;
            const ds = row.daily_submissions as
              | { submission_text: string; wordle_score: number }
              | { submission_text: string; wordle_score: number }[]
              | null
              | undefined;
            const sub = Array.isArray(ds) ? ds[0] : ds;
            return {
              id: row.id,
              user_id: row.user_id,
              message: row.message,
              message_type: row.message_type as 'chat' | 'result',
              submission_date: row.submission_date,
              created_at: row.created_at,
              display_name: profile?.display_name ?? 'Unknown',
              daily_submission_id: row.daily_submission_id ?? null,
              submission_text: sub?.submission_text ?? null,
              wordle_score: sub?.wordle_score ?? null,
            };
          }),
        );
      }
    } else {
      setChatMessages([]);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Tournament not found</Text>
      </View>
    );
  }

  const todaySubmittedIds = new Set(todaySubmissions.map(s => s.user_id));

  const isCompleted = tournament.status === 'closed';
  const startedToday = getTodayDateEST() === tournament.start_date;

  const handleBack = () => {
    if (router.canGoBack && router.canGoBack()) {
      router.back();
      return;
    }

    if (tournament.status === 'active') {
      router.replace('/(tabs)/tournaments');
    } else if (tournament.status === 'closed') {
      router.replace('/(tabs)/manage');
    } else {
      router.replace('/(tabs)/tournaments');
    }
  };

  const getPlayerStatus = (userId: string) => {
    const participant = participants.find(p => p.user_id === userId);
    if (participant?.forfeited) {
      return 'Forfeited';
    }
    const todayRow = todaySubmissions.find(s => s.user_id === userId);
    const isPenaltyRow = todayRow?.submission_text === NO_SUBMISSION_PENALTY_LABEL;
    if (todaySubmittedIds.has(userId) && !isPenaltyRow) {
      return 'Submitted';
    }
    if (resultsReady) {
      return 'No submission';
    }
    return 'Waiting';
  };

  const handleConfirmForfeit = async () => {
    if (!user || !id) return;
    try {
      setForfeitLoading(true);
      const { error } = await supabase.rpc('forfeit_tournament', {
        p_tournament_id: id,
      });

      if (error) {
        if (error.message?.includes('ALREADY_FORFEITED') || error.message?.toLowerCase().includes('already forfeited')) {
          Alert.alert('Already forfeited', 'You have already forfeited this tournament.');
        } else {
          Alert.alert('Error', 'Could not forfeit the tournament. Please try again.');
        }
        return;
      }

      await loadTournamentData();
    } finally {
      setForfeitLoading(false);
    }
  };

  const handleForfeitPress = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to forfeit this tournament? This will mark you as forfeited and you will receive a -2 penalty for every remaining day of this tournament. This cannot be undone.',
      );
      if (confirmed) {
        handleConfirmForfeit();
      }
      return;
    }

    Alert.alert(
      'Forfeit Tournament',
      'Are you sure you want to forfeit this tournament? This will mark you as forfeited and you will receive a -2 penalty for every remaining day of this tournament. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Forfeit', style: 'destructive', onPress: handleConfirmForfeit },
      ],
    );
  };

  const handleSendChat = async (text: string) => {
    if (!user || !id) return;
    setChatSending(true);
    try {
      const { error } = await supabase.from('tournament_chat').insert({
        tournament_id: id as string,
        user_id: user.id,
        message: text,
        message_type: 'chat',
      });
      if (error) {
        devLog('send chat failed', error);
        return;
      }
      await loadTournamentData();
    } finally {
      setChatSending(false);
    }
  };

  const canPostChat =
    !!tournament &&
    (tournament.status === 'active' || tournament.status === 'closed') &&
    participants.some(p => p.user_id === user?.id);

  const cutoffHourEst = config?.cutoffHourEst ?? 23;
  const cutoffLabel =
    cutoffHourEst === 0
      ? 'midnight'
      : cutoffHourEst === 12
        ? 'noon'
        : cutoffHourEst > 12
          ? `${cutoffHourEst - 12} PM`
          : `${cutoffHourEst} AM`;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{tournament.name}</Text>
          <Text style={styles.headerDate}>{tournament.status === 'active' ? 
          `Ends on: ${formatDateShort(tournament.end_date)}` :
          `Ended on: ${formatDateShort(tournament.end_date)}`
        }</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadTournamentData();
              setRefreshing(false);
            }}
          />
        }
      >


        

        {!resultsReady && tournament.status === 'active' && (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingText}>Waiting for today's submissions...</Text>
            <Text style={styles.waitingSubtext}>
              Results will be available after all active players submit or at {cutoffLabel} EST
            </Text>
          </View>
        )}

        


        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trophy size={20} color="#1a1a1a" />
            <Text style={styles.sectionTitle}>
              {isCompleted
                ? 'Final Standings'
                : resultsReady
                ? "Today's Leaderboard"
                : startedToday
                ? "Leaderboard (Waiting)"
                : "Yesterday's Leaderboard (Waiting)"}
            </Text>
          </View>

          

          {scores.length === 0 ? (
            <Text style={styles.emptyText}>No scores yet</Text>
          ) : (
            scores.map((score, index) => (
              <View key={score.user_id} style={styles.scoreCard}>
                <View style={styles.scoreRank}>
                  <Text style={styles.rankNumber}>#{index + 1}</Text>
                </View>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreName}>
                    {score.display_name}
                    {score.user_id === user?.id ? ' (You)' : ''}
                    {score.forfeited && <Text style={styles.forfeitedText}> (Forfeit)</Text>}
                  </Text>
                </View>
                <Text style={styles.scorePoints}>
                  {`${score.total_score} pts`}
                </Text>
              </View>
            ))
          )}
        </View>

        <TournamentChatSection
          messages={chatMessages}
          currentUserId={user?.id}
          todayEst={getTodayDateEST()}
          resultsReadyForToday={resultsReady}
          canCompose={canPostChat}
          sending={chatSending}
          onSend={handleSendChat}
        />

        {participants.length > 0 && tournament.status === 'active' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Players</Text>
            {participants.map(p => (
              <View key={p.user_id} style={styles.playerRow}>
                <Text style={styles.playerName}>{p.display_name}{p.user_id === user?.id ? ' (You)' : ''}</Text>
                <Text style={styles.playerStatus}>{getPlayerStatus(p.user_id)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* All Results section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Submissions</Text>
          {participants.length === 0 ? (
            <Text style={styles.emptyText}>No players in this tournament</Text>
          ) : allSubmissions.length === 0 ? (
            <Text style={styles.emptyText}>No submissions yet</Text>
          ) : (
            <>
              {(() => {
                const startDateStr = tournament.start_date.slice(0, 10);
                const endDateStr = tournament.end_date.slice(0, 10);
                const todayStr = getTodayDateEST();
                const yesterdayStr = getYesterdayDateEST();

                // Determine last visible date:
                // - Always show all fully past days.
                // - Only show "today" when results are ready or the tournament is completed.
                let maxDateStr: string | null = null;

                if (isCompleted || resultsReady) {
                  maxDateStr = todayStr <= endDateStr ? todayStr : endDateStr;
                } else {
                  const candidate =
                    yesterdayStr <= endDateStr ? yesterdayStr : endDateStr;
                  maxDateStr = candidate >= startDateStr ? candidate : null;
                }

                const days: string[] = [];

                const addOneDay = (dateStr: string) => {
                  const [y, m, d] = dateStr.split('-').map(Number);
                  const dt = new Date(y, m - 1, d);
                  dt.setDate(dt.getDate() + 1);
                  const year = dt.getFullYear();
                  const month = String(dt.getMonth() + 1).padStart(2, '0');
                  const day = String(dt.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                };

                if (maxDateStr && startDateStr <= maxDateStr) {
                  let current = startDateStr;
                  while (current <= maxDateStr) {
                    days.push(current);
                    current = addOneDay(current);
                  }
                }

                // Show most recent day first
                const orderedDays = [...days].reverse();

                return orderedDays.map(date => {
                  const submissionsForDay = allSubmissions.filter(
                    s => s.submission_date === date,
                  );

                  return (
                    <View key={date} style={styles.resultsDay}>
                      <Text style={styles.resultsDayTitle}>
                        {formatDateShort(date)}
                      </Text>
                      <View style={styles.resultsDayDivider} />
                      {participants.map(p => {
                        const sub = submissionsForDay.find(
                          s => s.user_id === p.user_id,
                        );
                        const isForfeitPenaltyDay =
                          p.forfeited &&
                          p.forfeited_at_date != null &&
                          date >= p.forfeited_at_date;
                        const isPenaltyRow =
                          sub?.submission_text === NO_SUBMISSION_PENALTY_LABEL;
                        const didSubmit =
                          !!sub && !isForfeitPenaltyDay && !isPenaltyRow;
                        const score = isForfeitPenaltyDay
                          ? -2
                          : isPenaltyRow
                          ? -2
                          : typeof sub?.wordle_score === 'number'
                          ? sub.wordle_score
                          : -2;
                        const submissionText = isForfeitPenaltyDay || isPenaltyRow
                          ? undefined
                          : sub?.submission_text;

                        return (
                          <DailySubmissionCard
                            key={p.user_id + date}
                            dateLabel={date}
                            playerName={p.display_name}
                            didSubmit={didSubmit}
                            score={score}
                            submissionText={submissionText}
                          />
                        );
                      })}
                    </View>
                  );
                });
              })()}
            </>
          )}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tournament Info</Text>
          <View style={styles.infoCard}>
            
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>{tournament.status.toUpperCase()}</Text>
            <Text style={styles.infoLabel}>Dates</Text>
            <Text style={styles.infoValue}>
              {formatDateShort(tournament.start_date)} - {formatDateShort(
                tournament.end_date,
              )}
            </Text>
            <Text style={styles.infoLabel}>Join Code</Text>
            <Text style={styles.infoValue}>{tournament.join_code}</Text>
          </View>
        </View>
        {tournament.status === 'active' &&
          participants.some(p => p.user_id === user?.id && !p.forfeited) && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.forfeitButton, forfeitLoading && { opacity: 0.7 }]}
                onPress={handleForfeitPress}
                disabled={forfeitLoading}
              >
                <Text style={styles.forfeitButtonText}>
                  {forfeitLoading ? 'Forfeiting...' : 'Forfeit Tournament'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerDate: {
    fontSize: 24,
    color: '#fff',
  },
  headerText: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 16,
    marginTop: 8,
    padding: 4,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
    marginBottom: 6,
  },
  waitingCard: {
    backgroundColor: '#fef3c7',
    marginHorizontal: 16,
    marginBottom: 0,
    padding: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  waitingText: {
    fontSize: 16,
    color: '#92400e',
    fontWeight: '600',
    marginBottom: 4,
  },
  waitingSubtext: {
    fontSize: 14,
    color: '#92400e',
  },
  section: {
    padding: 16,
  },
  resultsDay: {
    marginBottom: 16,
  },
  resultsDayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  resultsDayDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  leaderboardStatus: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  leaderboardSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
  scoreCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  forfeitedText: {
    color: '#ef4444',
    fontSize: 14,
  },
  scorePoints: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    paddingVertical: 20,
  },
  submissionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  submissionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  submissionScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  playerName: {
    fontSize: 14,
    color: '#1f2933',
  },
  playerStatus: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  wordleGrid: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  wordleRow: {
    fontSize: 20,
    marginBottom: 2,
    letterSpacing: 4,
  },
  forfeitButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  forfeitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
