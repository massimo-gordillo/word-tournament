import { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { AppColors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Trophy, Target, TrendingUp } from 'lucide-react-native';
import { useAppConfig } from '@/contexts/ConfigContext';
import { formatDateLong } from '@/lib/dateUtils';
import { copy } from '@/app/copy/strings';

interface Stats {
  averageScore: number;
  totalSubmissions: number;
  tournamentWins: number;
  tournamentsParticipated: number;
  bestScore: number;
  bestScoreDate: string | null;
  worstScore: number;
}

export default function StatisticsScreen() {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const { width } = useWindowDimensions();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isWideLayout = width >= 768;
  const isUltraNarrowLayout = width < 300;
  const statCardLayoutStyle = isWideLayout
    ? styles.statCardWide
    : isUltraNarrowLayout
      ? styles.statCardUltraNarrow
      : styles.statCardNarrow;


  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    if (!user) return;

    const { data: submissions } = await supabase
      .from('daily_submissions')
      .select('wordle_score, submission_date')
      .eq('user_id', user.id)
      .neq('submission_text', 'NO SUBMISSION - PENALTY');

    const totalSubmissions = submissions?.length || 0;
    const scores = submissions?.map(s => s.wordle_score) || [];
    const averageScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const bestScoreDate = submissions
      ?.filter(s => s.wordle_score === bestScore)
      .sort((a, b) => b.submission_date.localeCompare(a.submission_date))[0]
      ?.submission_date ?? null;
    const worstScore = scores.length > 0 ? Math.min(...scores.filter(s => s > 0)) : 0;

    const { data: wonTournaments } = await supabase
      .from('tournament_winners')
      .select('tournament_id')
      .eq('user_id', user.id);

    const { data: participations } = await supabase
      .from('tournament_participants')
      .select(`
        tournament_id,
        tournaments!inner(status)
      `)
      .eq('user_id', user.id)
      .neq('tournaments.status', 'draft')
      .neq('tournaments.status', 'cancelled');


    setStats({
      averageScore: Math.round(averageScore * 10) / 10,
      totalSubmissions,
      tournamentWins: wonTournaments?.length || 0,
      tournamentsParticipated: participations?.length || 0,
      bestScore,
      bestScoreDate,
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
        <ActivityIndicator size="large" color={AppColors.brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{copy.stats.title}</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, statCardLayoutStyle]}>
            <View style={styles.statIcon}>
              <Target size={24} color={AppColors.brand.primary} />
            </View>
            <Text style={styles.statValue}>{stats?.averageScore.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{copy.stats.averageScore}</Text>
            <Text style={styles.statSubtext}>{copy.stats.averageSubtext}</Text>
          </View>

          <View style={[styles.statCard, statCardLayoutStyle]}>
            <View style={styles.statIcon}>
              <TrendingUp size={24} color={AppColors.accent.blue} />
            </View>
            <Text style={styles.statValue}>{stats?.totalSubmissions}</Text>
            <Text style={styles.statLabel}>{copy.stats.totalSubmissions}</Text>
            <Text style={styles.statSubtext}>{copy.stats.submissionsSubtext}</Text>
          </View>

          <View style={[styles.statCard, statCardLayoutStyle]}>
            <View style={styles.statIcon}>
              <Trophy size={24} color={AppColors.status.warning} />
            </View>
            <Text style={styles.statValue}>{stats?.tournamentWins}</Text>
            <Text style={styles.statLabel}>{copy.stats.tournamentWins}</Text>
            <Text style={styles.statSubtext}>{copy.stats.winsSubtext}</Text>
          </View>

          <View style={[styles.statCard, statCardLayoutStyle]}>
            <View style={styles.statIcon}>
              <Trophy size={24} color={AppColors.accent.purple} />
            </View>
            <Text style={styles.statValue}>{stats?.tournamentsParticipated}</Text>
            <Text style={styles.statLabel}>{copy.stats.tournamentsLabel}</Text>
            <Text style={styles.statSubtext}>{copy.stats.participationSubtext}</Text>
          </View>
        </View>

        <View style={styles.section}>
        <Text style={styles.sectionTitle}>{copy.stats.bestScoreSection}</Text>
          <View style={styles.detailCard}>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.detailValue}>
                {stats?.bestScoreDate ? formatDateLong(stats.bestScoreDate) : copy.stats.na}
              </Text>
              <Text style={styles.detailValue}>
                {stats?.bestScore
                  ? ` ${stats.bestScore} ${copy.stats.pointsSuffix}`
                  : copy.stats.na}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.stats.scoringGuide}</Text>

          <View style={styles.detailCard}>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>{copy.stats.guess1}</Text>
              <Text style={styles.guideValue}>
                {config?.pointsGuess1 ?? 20} {copy.stats.pointsSuffix}
              </Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>{copy.stats.guess2}</Text>
              <Text style={styles.guideValue}>
                {config?.pointsGuess2 ?? 6} {copy.stats.pointsSuffix}
              </Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>{copy.stats.guess3}</Text>
              <Text style={styles.guideValue}>
                {config?.pointsGuess3 ?? 4} {copy.stats.pointsSuffix}
              </Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>{copy.stats.guess4}</Text>
              <Text style={styles.guideValue}>
                {config?.pointsGuess4 ?? 3} {copy.stats.pointsSuffix}
              </Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>{copy.stats.guess5}</Text>
              <Text style={styles.guideValue}>
                {config?.pointsGuess5 ?? 2} {copy.stats.pointsSuffix}
              </Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>{copy.stats.guess6}</Text>
              <Text style={styles.guideValue}>
                {config?.pointsGuess6 ?? 1} {copy.stats.guess6PointSuffix}
              </Text>
            </View>
            <View style={styles.scoreGuideRow}>
              <Text style={styles.guideLabel}>{copy.stats.missedFailed}</Text>
              <Text style={[styles.guideValue, { color: AppColors.status.error }]}>
                {config?.pointsMissed ?? -2} {copy.stats.pointsSuffix}
              </Text>
            </View>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: AppColors.background.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardNarrow: {
    width: '48%',
  },
  statCardUltraNarrow: {
    width: '100%',
  },
  statCardWide: {
    width: '23%',
  },
  statIcon: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: AppColors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.text.muted,
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 12,
    color: AppColors.text.placeholder,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: AppColors.text.primary,
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: AppColors.background.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: AppColors.shadow,
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
    borderBottomColor: AppColors.background.subtle,
  },
  detailLabel: {
    fontSize: 16,
    color: AppColors.text.muted,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text.primary,
  },
  scoreGuideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  guideLabel: {
    fontSize: 14,
    color: AppColors.text.muted,
  },
  guideValue: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.brand.primary,
  },
});
