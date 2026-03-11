import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Trophy } from 'lucide-react-native';
import { getTodayDateEST, getYesterdayDateEST, getDateInEST } from '@/lib/dateUtils';
import { formatDateShort } from '@/utils/dateUtils';
import { DailySubmissionCard } from '@/components/DailySubmissionCard';

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
  const { id } = useLocalSearchParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [todaySubmissions, setTodaySubmissions] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [participants, setParticipants] = useState<
    { user_id: string; display_name: string; forfeited: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [resultsReady, setResultsReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      .select('user_id, forfeited')
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

      const submittedUserIds = todaySubmissionsData.map(s => s.user_id);
      const allSubmitted = participantIds.length === 0
        ? false
        : participantIds.length === submittedUserIds.length;

      const estNow = getDateInEST();
      const isPastCutoff = estNow.getHours() >= 23;

      const ready = allSubmitted || isPastCutoff;
      setResultsReady(ready);

      setTodaySubmissions(todaySubmissionsData);

      // Leaderboard: use submissions up to yesterday or today depending on readiness
      const baseCutoff = ready ? getTodayDateEST() : getYesterdayDateEST();
      const cutoffDate =
        baseCutoff < tournamentData.end_date ? baseCutoff : tournamentData.end_date;

      const totals = new Map<string, number>();
      allSubmissionsWithNames
        .filter(
          s =>
            s.submission_date >= tournamentData.start_date &&
            s.submission_date <= cutoffDate,
        )
        .forEach(s => {
          totals.set(s.user_id, (totals.get(s.user_id) || 0) + s.wordle_score);
        });

      const formattedScores = participantDetails
        .map(p => ({
          user_id: p.user_id,
          total_score: p.forfeited ? 0 : totals.get(p.user_id) || 0,
          display_name: p.display_name,
          forfeited: p.forfeited,
        }))
        .sort((a, b) => b.total_score - a.total_score);

      setScores(formattedScores);
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
    if (todaySubmittedIds.has(userId)) {
      return 'Submitted';
    }
    if (resultsReady) {
      return 'No submission';
    }
    return 'Waiting';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{tournament.name}</Text>
          <Text style={styles.headerDate}>{`Ends on ${formatDateShort(
            tournament.end_date,
          )}`}</Text>
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
            <Text style={styles.waitingSubtext}>Results will be available after all players submit or at 11 PM EST</Text>
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
                  {score.display_name}{score.user_id === user?.id ? ' (You)' : ''}
                    {score.forfeited && <Text style={styles.forfeitedText}> (Forfeited)</Text>}
                  </Text>
                </View>
                <Text style={styles.scorePoints}>{score.total_score} pts</Text>
              </View>
            ))
          )}
        </View>

        {participants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Players</Text>
            {participants.map(p => (
              <View key={p.user_id} style={styles.playerRow}>
                <Text style={styles.playerName}>{p.display_name}</Text>
                <Text style={styles.playerStatus}>{getPlayerStatus(p.user_id)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* All Results section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Results</Text>
          {participants.length === 0 ? (
            <Text style={styles.emptyText}>No players in this tournament</Text>
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
                        const didSubmit = !!sub;

                        return (
                          <DailySubmissionCard
                            key={p.user_id + date}
                            playerName={p.display_name}
                            didSubmit={didSubmit}
                            score={sub?.wordle_score}
                            submissionText={sub?.submission_text}
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
      </ScrollView>
    </View>
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#10b981',
    padding: 24,
    paddingTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
});
