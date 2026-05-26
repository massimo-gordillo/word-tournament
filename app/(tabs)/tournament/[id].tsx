import { useState, useCallback, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/ConfigContext';
import { supabase } from '@/lib/supabase';
import { ChevronDown, ChevronLeft, ChevronUp, Trophy } from 'lucide-react-native';
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
import { copy, fillCopyTemplate } from '@/app/copy/strings';
import { withTimeout } from '@/lib/requestTimeout';

const NO_SUBMISSION_PENALTY_LABEL = 'NO SUBMISSION - PENALTY';
const TOURNAMENT_REQUEST_TIMEOUT_MS = 15000;

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

const FANFARE_CONFETTI = ['🎉', '✨', '⭐', '🎊', '🏆', '💚', '🟨', '🟩'];
const FANFARE_PIECES = 16;

export default function TournamentDetailScreen() {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
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
  const [allSubmissionsCollapsed, setAllSubmissionsCollapsed] = useState(false);
  const [tournamentInfoCollapsed, setTournamentInfoCollapsed] = useState(true);
  const [winnerUserIds, setWinnerUserIds] = useState<Set<string>>(new Set());
  const [showFanfare, setShowFanfare] = useState(false);
  const [loadError, setLoadError] = useState('');
  const confettiValues = useRef(
    Array.from({ length: FANFARE_PIECES }, () => new Animated.Value(0)),
  ).current;
  const fanfareScale = useRef(new Animated.Value(0.8)).current;
  const fanfareOpacity = useRef(new Animated.Value(0)).current;
  const celebratedTournamentIdRef = useRef<string | null>(null);
  const confettiDropDistance = Platform.OS === 'web' ? 320 : 420;

  const loadTournamentData = useCallback(async (options?: { soft?: boolean }) => {
    if (!id) return;

    const soft = options?.soft ?? false;
    if (!soft) {
      setLoading(true);
      setLoadError('');
      setTournament(null);
      setScores([]);
      setTodaySubmissions([]);
      setAllSubmissions([]);
      setParticipants([]);
      setResultsReady(false);
      setChatMessages([]);
      setWinnerUserIds(new Set());
    }

    try {
      const { data: tournamentData, error: tournamentError } = await withTimeout(
        supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single(),
        TOURNAMENT_REQUEST_TIMEOUT_MS,
        'Loading tournament timed out',
      );

      if (tournamentError || !tournamentData) {
        setLoadError('Could not load this tournament. Please try again.');
        return;
      }

      if (tournamentData.status === 'draft') {
        router.replace({
          pathname: '/draft-tournament/[id]',
          params: { id: id as string, source: source ?? 'tournaments' },
        });
        return;
      }
      setTournament(tournamentData);

      if (tournamentData.status === 'closed') {
        const { data: winnersData } = await withTimeout(
          supabase
            .from('tournament_winners')
            .select('user_id')
            .eq('tournament_id', id),
          TOURNAMENT_REQUEST_TIMEOUT_MS,
          'Loading winners timed out',
        );

        setWinnerUserIds(new Set((winnersData ?? []).map(w => w.user_id)));
      } else {
        setWinnerUserIds(new Set());
      }

      const { data: allParticipants } = await withTimeout(
        supabase
          .from('tournament_participants')
          .select('user_id, forfeited, forfeited_at_date')
          .eq('tournament_id', id),
        TOURNAMENT_REQUEST_TIMEOUT_MS,
        'Loading participants timed out',
      );

      if (allParticipants) {
      const participantIds = allParticipants.map(p => p.user_id);

      const { data: usersData } = await withTimeout(
        supabase
          .from('users')
          .select('id, display_name')
          .in('id', participantIds),
        TOURNAMENT_REQUEST_TIMEOUT_MS,
        'Loading user profiles timed out',
      );

      const usersMap = new Map(usersData?.map(u => [u.id, u.display_name]));
      const forfeitedMap = new Map(allParticipants.map(p => [p.user_id, p.forfeited]));

      const participantDetails = allParticipants.map(p => ({
        user_id: p.user_id,
        display_name: usersMap.get(p.user_id) || copy.tournamentDetail.unknownPlayer,
        forfeited: forfeitedMap.get(p.user_id) || false,
        forfeited_at_date: p.forfeited_at_date ?? null,
      }));

      setParticipants(participantDetails);

      // All submissions for this tournament window
      const { data: allSubmissionsData } = await withTimeout(
        supabase
          .from('daily_submissions')
          .select('user_id, submission_text, wordle_score, submission_date')
          .in('user_id', participantIds)
          .gte('submission_date', tournamentData.start_date)
          .lte('submission_date', tournamentData.end_date),
        TOURNAMENT_REQUEST_TIMEOUT_MS,
        'Loading submissions timed out',
      );

      const allSubmissionsWithNames: Submission[] =
        allSubmissionsData?.map(s => ({
          ...s,
          display_name: usersMap.get(s.user_id) || copy.tournamentDetail.unknownPlayer,
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
          const isPenaltySubmission =
            s.submission_text === NO_SUBMISSION_PENALTY_LABEL;
          const effectiveScore = isPenaltySubmission ? -2 : s.wordle_score;
          submissionScoreByUserAndDay.set(
            `${s.user_id}:${s.submission_date}`,
            effectiveScore,
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

      const { data: chatData, error: chatErr } = await withTimeout(
        supabase
          .from('tournament_chat')
          .select(
            'id, user_id, message, message_type, submission_date, created_at, daily_submission_id, users(display_name), daily_submissions!tournament_chat_daily_submission_id_fkey(submission_text, wordle_score)',
          )
          .eq('tournament_id', id)
          .order('created_at', { ascending: true }),
        TOURNAMENT_REQUEST_TIMEOUT_MS,
        'Loading chat timed out',
      );

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
              display_name: profile?.display_name ?? copy.tournamentDetail.unknownPlayer,
              daily_submission_id: row.daily_submission_id ?? null,
              submission_text: sub?.submission_text ?? null,
              wordle_score: sub?.wordle_score ?? null,
            };
          }),
        );
      }
    } catch (err) {
      devLog('loadTournamentData failed', err);
      setLoadError('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [config?.cutoffHourEst, id, source]);

  useFocusEffect(
    useCallback(() => {
      celebratedTournamentIdRef.current = null;
      setShowFanfare(false);
      fanfareOpacity.setValue(0);
      fanfareScale.setValue(0.8);
      confettiValues.forEach(v => v.setValue(0));
      setAllSubmissionsCollapsed(false);
      setTournamentInfoCollapsed(true);
      void loadTournamentData();
    }, [confettiValues, fanfareOpacity, fanfareScale, loadTournamentData])
  );

  useEffect(() => {
    const isWinner =
      !!user?.id &&
      !!tournament?.id &&
      tournament.status === 'closed' &&
      winnerUserIds.has(user.id);

    if (!isWinner) return;
    if (celebratedTournamentIdRef.current === tournament.id) return;

    celebratedTournamentIdRef.current = tournament.id;
    setShowFanfare(true);

    fanfareScale.setValue(0.8);
    fanfareOpacity.setValue(0);
    confettiValues.forEach(v => v.setValue(0));

    const confettiDurationBase = Platform.OS === 'web' ? 1150 : 1400;
    const confettiAnimations = confettiValues.map((value, index) =>
      Animated.timing(value, {
        toValue: 1,
        duration: confettiDurationBase + (index % 4) * 150,
        delay: (index % 6) * 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );

    Animated.parallel([
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fanfareScale, {
            toValue: 1.06,
            duration: 220,
            easing: Easing.out(Easing.back(1.3)),
            useNativeDriver: true,
          }),
          Animated.timing(fanfareOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(fanfareScale, {
          toValue: 1,
          duration: 170,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(45, confettiAnimations),
    ]).start();

    const timeout = setTimeout(() => {
      Animated.timing(fanfareOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => setShowFanfare(false));
    }, 2200);

    return () => clearTimeout(timeout);
  }, [confettiValues, fanfareOpacity, fanfareScale, tournament, user?.id, winnerUserIds]);

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
        <Text>{loadError || copy.tournamentDetail.notFound}</Text>
        <TouchableOpacity style={styles.retryLoadButton} onPress={() => void loadTournamentData()}>
          <Text style={styles.retryLoadButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const todaySubmittedIds = new Set(todaySubmissions.map(s => s.user_id));

  const isCompleted = tournament.status === 'closed';
  const startedToday = getTodayDateEST() === tournament.start_date;

  const handleBack = () => {
    if (source === 'manage') {
      router.replace('/(tabs)/manage');
      return;
    }

    if (source === 'tournaments') {
      router.replace('/(tabs)/tournaments');
      return;
    }

    router.replace('/(tabs)/tournaments');
  };

  const getPlayerStatus = (userId: string) => {
    const participant = participants.find(p => p.user_id === userId);
    if (participant?.forfeited) {
      return copy.tournamentDetail.playerStatusForfeited;
    }
    const todayRow = todaySubmissions.find(s => s.user_id === userId);
    const isPenaltyRow = todayRow?.submission_text === NO_SUBMISSION_PENALTY_LABEL;
    if (todaySubmittedIds.has(userId) && !isPenaltyRow) {
      return copy.tournamentDetail.playerStatusSubmitted;
    }
    if (resultsReady) {
      return copy.tournamentDetail.playerStatusNoSubmission;
    }
    return copy.tournamentDetail.playerStatusWaiting;
  };

  const handleConfirmForfeit = async () => {
    if (!user || !id) return;
    try {
      setForfeitLoading(true);
      const { error } = await withTimeout(
        supabase.rpc('forfeit_tournament', {
          p_tournament_id: id,
        }),
        TOURNAMENT_REQUEST_TIMEOUT_MS,
        'Forfeit request timed out',
      );

      if (error) {
        if (error.message?.includes('ALREADY_FORFEITED') || error.message?.toLowerCase().includes('already forfeited')) {
          Alert.alert(
            copy.tournamentDetail.forfeitAlreadyTitle,
            copy.tournamentDetail.forfeitAlreadyBody,
          );
        } else {
          Alert.alert(copy.tournamentDetail.forfeitErrorTitle, copy.tournamentDetail.forfeitErrorBody);
        }
        return;
      }

      await loadTournamentData({ soft: true });
    } finally {
      setForfeitLoading(false);
    }
  };

  const handleForfeitPress = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(copy.tournamentDetail.forfeitAlertBody);
      if (confirmed) {
        handleConfirmForfeit();
      }
      return;
    }

    Alert.alert(copy.tournamentDetail.forfeitAlertTitle, copy.tournamentDetail.forfeitAlertBody, [
      { text: copy.tournamentDetail.cancel, style: 'cancel' },
      { text: copy.tournamentDetail.forfeit, style: 'destructive', onPress: handleConfirmForfeit },
    ]);
  };

  const handleSendChat = async (text: string) => {
    if (!user || !id) return;
    setChatSending(true);
    try {
      const { error } = await withTimeout(
        supabase.from('tournament_chat').insert({
          tournament_id: id as string,
          user_id: user.id,
          message: text,
          message_type: 'chat',
        }),
        TOURNAMENT_REQUEST_TIMEOUT_MS,
        'Sending message timed out',
      );
      if (error) {
        devLog('send chat failed', error);
        return;
      }
      await loadTournamentData({ soft: true });
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
      ? copy.tournamentDetail.cutoffMidnight
      : cutoffHourEst === 12
        ? copy.tournamentDetail.cutoffNoon
        : cutoffHourEst > 12
          ? fillCopyTemplate(copy.tournamentDetail.cutoffPmTemplate, { hour: cutoffHourEst - 12 })
          : fillCopyTemplate(copy.tournamentDetail.cutoffAmTemplate, { hour: cutoffHourEst });

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      {showFanfare && (
        <View pointerEvents="none" style={styles.fanfareOverlay}>
          {confettiValues.map((value, index) => (
            <Animated.Text
              key={`fanfare-${index}`}
              style={[
                styles.confettiPiece,
                {
                  left: `${(index % 8) * 12 + 4}%`,
                  opacity: value.interpolate({
                    inputRange: [0, 0.75, 1],
                    outputRange: [1, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: value.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-40, confettiDropDistance],
                      }),
                    },
                    {
                      translateX: value.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, index % 2 === 0 ? -28 : 28],
                      }),
                    },
                    {
                      rotate: value.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', index % 2 === 0 ? '-190deg' : '190deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              {FANFARE_CONFETTI[index % FANFARE_CONFETTI.length]}
            </Animated.Text>
          ))}
          <Animated.View
            style={[
              styles.fanfareBadge,
              {
                opacity: fanfareOpacity,
                transform: [{ scale: fanfareScale }],
              },
            ]}
          >
            <Text style={styles.fanfareText}>{copy.tournamentDetail.championFanfare}</Text>
          </Animated.View>
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{tournament.name}</Text>
          <Text style={styles.headerDate}>
            {tournament.status === 'active'
              ? `${copy.tournamentDetail.headerEndsOn}${formatDateShort(tournament.end_date)}`
              : `${copy.tournamentDetail.headerEndedOn}${formatDateShort(tournament.end_date)}`}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadTournamentData({ soft: true });
              setRefreshing(false);
            }}
          />
        }
      >


        

        {!resultsReady && tournament.status === 'active' && (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingText}>{copy.tournamentDetail.resultsWaitingTitle}</Text>
            <Text style={styles.waitingSubtext}>
              {fillCopyTemplate(copy.tournamentDetail.resultsWaitingSubtext, { cutoff: cutoffLabel })}
            </Text>
          </View>
        )}

        


        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trophy size={20} color="#1a1a1a" />
            <Text style={styles.sectionTitle}>
              {isCompleted
                ? copy.tournamentDetail.leaderboardFinal
                : resultsReady
                  ? copy.tournamentDetail.leaderboardToday
                  : startedToday
                    ? copy.tournamentDetail.leaderboardWaiting
                    : copy.tournamentDetail.leaderboardYesterdayWaiting}
            </Text>
          </View>

          

          {scores.length === 0 ? (
            <Text style={styles.emptyText}>{copy.tournamentDetail.emptyNoScores}</Text>
          ) : (
            scores.map((score, index) => (
              <View key={score.user_id} style={styles.scoreCard}>
                <View style={styles.scoreRank}>
                  {isCompleted && winnerUserIds.has(score.user_id) ? (
                    <Text style={styles.rankNumber}>🏆</Text>
                  ) : (
                    <Text style={styles.rankNumber}>#{index + 1}</Text>
                  )}
                </View>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreName}>
                    {score.display_name}
                    {score.user_id === user?.id ? copy.tournamentDetail.youSuffix : ''}
                    {score.forfeited && (
                      <Text style={styles.forfeitedText}>{copy.tournamentDetail.forfeitSuffix}</Text>
                    )}
                  </Text>
                </View>
                <Text style={styles.scorePoints}>
                  {`${score.total_score}${copy.tournamentDetail.pointsSuffix}`}
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
            <Text style={styles.sectionTitle}>{copy.tournamentDetail.playersSection}</Text>
            {participants.map(p => (
              <View key={p.user_id} style={styles.playerRow}>
                <Text style={styles.playerName}>
                  {p.display_name}
                  {p.user_id === user?.id ? copy.tournamentDetail.youSuffix : ''}
                </Text>
                <Text style={styles.playerStatus}>{getPlayerStatus(p.user_id)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* All Results section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setAllSubmissionsCollapsed(prev => !prev)}
          >
            <Text style={styles.sectionTitle}>{copy.tournamentDetail.allSubmissions}</Text>
            {allSubmissionsCollapsed ? (
              <ChevronDown size={20} color="#1a1a1a" />
            ) : (
              <ChevronUp size={20} color="#1a1a1a" />
            )}
          </TouchableOpacity>
          {!allSubmissionsCollapsed && (
            <>
              {participants.length === 0 ? (
                <Text style={styles.emptyText}>{copy.tournamentDetail.emptyNoPlayers}</Text>
              ) : allSubmissions.length === 0 ? (
                <Text style={styles.emptyText}>{copy.tournamentDetail.emptyNoSubmissions}</Text>
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
                    if (orderedDays.length === 0) {
                      return (
                        <Text style={styles.emptyText}>{copy.tournamentDetail.waitingSubmissionsDay}</Text>
                      );
                    }

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
            </>
          )}
        </View>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setTournamentInfoCollapsed(prev => !prev)}
          >
            <Text style={styles.sectionTitle}>{copy.tournamentDetail.tournamentInfo}</Text>
            {tournamentInfoCollapsed ? (
              <ChevronDown size={20} color="#1a1a1a" />
            ) : (
              <ChevronUp size={20} color="#1a1a1a" />
            )}
          </TouchableOpacity>
          {!tournamentInfoCollapsed && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{copy.tournamentDetail.statusLabel}</Text>
              <Text style={styles.infoValue}>{tournament.status.toUpperCase()}</Text>
              <Text style={styles.infoLabel}>{copy.tournamentDetail.datesLabel}</Text>
              <Text style={styles.infoValue}>
                {formatDateShort(tournament.start_date)} - {formatDateShort(
                  tournament.end_date,
                )}
              </Text>
              <Text style={styles.infoLabel}>{copy.tournamentDetail.joinCodeLabel}</Text>
              <Text style={styles.infoValue}>{tournament.join_code}</Text>
            </View>
          )}
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
                  {forfeitLoading
                    ? copy.tournamentDetail.forfeiting
                    : copy.tournamentDetail.forfeitButton}
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
  fanfareOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    fontSize: 20,
  },
  fanfareBadge: {
    marginTop: 90,
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  fanfareText: {
    color: '#92400e',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryLoadButton: {
    marginTop: 12,
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  retryLoadButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  wordGrid: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  wordRow: {
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
