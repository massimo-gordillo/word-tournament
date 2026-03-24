import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Trophy, Target, TrendingUp } from 'lucide-react-native';
import { useAppConfig } from '@/contexts/ConfigContext';

interface Stats {
  averageScore: number;
  totalSubmissions: number;
  tournamentWins: number;
  tournamentsParticipated: number;
  bestScore: number;
  worstScore: number;
}

export default function StatisticsScreen() {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    if (!user) return;

    const { data: submissions } = await supabase
      .from('daily_submissions')
      .select('wordle_score')
      .eq('user_id', user.id)
      .neq('submission_text', 'NO SUBMISSION - PENALTY');

    const totalSubmissions = submissions?.length || 0;
    const scores = submissions?.map(s => s.wordle_score) || [];
    const averageScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const worstScore = scores.length > 0 ? Math.min(...scores.filter(s => s > 0)) : 0;

    const { data: tournamentScores } = await supabase
      .from('tournament_scores')
      .select(`
        tournament_id,
        total_score,
        tournaments!inner(status)
      `)
      .eq('user_id', user.id);

    const closedTournaments = tournamentScores?.filter(
      (ts: any) => ts.tournaments.status === 'closed'
    ) || [];

    let wins = 0;
    for (const tournament of closedTournaments) {
      const { data: allScores } = await supabase
        .from('tournament_scores')
        .select('total_score')
        .eq('tournament_id', tournament.tournament_id)
        .order('total_score', { ascending: false });

      if (!allScores || allScores.length === 0) {
        continue;
      }
      if (allScores[0].total_score !== tournament.total_score) {
        continue;
      }
      wins++;
    }

    const { data: participations } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', user.id)
      .neq('tournament_id', 'draft')
      .neq('tournament_id', 'cancelled');


    setStats({
      averageScore: Math.round(averageScore * 10) / 10,
      totalSubmissions,
      tournamentWins: wins,
      tournamentsParticipated: participations?.length || 0,
      bestScore,
      worstScore,
    });

    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStatistics();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Statistics</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Target size={24} color="#10b981" />
            </View>
            <Text style={styles.statValue}>{stats?.averageScore.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Average Score</Text>
            <Text style={styles.statSubtext}>Excluding penalties</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <TrendingUp size={24} color="#3b82f6" />
            </View>
            <Text style={styles.statValue}>{stats?.totalSubmissions}</Text>
            <Text style={styles.statLabel}>Total Submissions</Text>
            <Text style={styles.statSubtext}>Wordles completed</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Trophy size={24} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>{stats?.tournamentWins}</Text>
            <Text style={styles.statLabel}>Tournament Wins</Text>
            <Text style={styles.statSubtext}>1st place finishes</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Trophy size={24} color="#8b5cf6" />
            </View>
            <Text style={styles.statValue}>{stats?.tournamentsParticipated}</Text>
            <Text style={styles.statLabel}>Tournaments</Text>
            <Text style={styles.statSubtext}>Total participation</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score Details</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Best Score</Text>
              <Text style={styles.detailValue}>{stats?.bestScore} points</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Worst Score</Text>
              <Text style={styles.detailValue}>{stats?.worstScore} points</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scoring Guide</Text>

          <View style={styles.detailCard}>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>1 Guess</Text>
              <Text style={styles.guideValue}>{config?.pointsGuess1 ?? 20} points</Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>2 Guesses</Text>
              <Text style={styles.guideValue}>{config?.pointsGuess2 ?? 8} points</Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>3 Guesses</Text>
              <Text style={styles.guideValue}>{config?.pointsGuess3 ?? 6} points</Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>4 Guesses</Text>
              <Text style={styles.guideValue}>{config?.pointsGuess4 ?? 4} points</Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>5 Guesses</Text>
              <Text style={styles.guideValue}>{config?.pointsGuess5 ?? 2} points</Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>6 Guesses</Text>
              <Text style={styles.guideValue}>{config?.pointsGuess6 ?? 1} point</Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>Missed/Failed</Text>
              <Text style={[styles.guideValue, { color: '#ef4444' }]}>
                {config?.pointsMissed ?? -2} points
              </Text>
            </View>
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
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  scoreGuideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  guideLabel: {
    fontSize: 14,
    color: '#666',
  },
  guideValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
});
