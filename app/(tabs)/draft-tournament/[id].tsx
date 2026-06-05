import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, RefreshControl, Platform } from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Users, Copy, Play, Trash2 } from 'lucide-react-native';
import { useAppConfig } from '@/contexts/ConfigContext';
import { copy, fillCopyTemplate } from '@/app/copy/strings';
import { calendarDaysInclusiveCount } from '@/lib/dateUtils';

/** Cross-platform confirm: Alert.alert on native, window.confirm on web (Alert.alert doesn't work on web). */
function confirmDiscard(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  onCancel?: () => void
) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
    const ok = window.confirm([title, message].filter(Boolean).join('\n\n'));
    if (ok) {
      void Promise.resolve(onConfirm());
    } else {
      onCancel?.();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: copy.draftTournament.discardKeep, style: 'cancel', onPress: onCancel },
    {
      text: copy.draftTournament.discardDestructive,
      style: 'destructive',
      onPress: () => void Promise.resolve(onConfirm()),
    },
  ]);
}

/** Calendar days from `start_date` / `end_date` (same inclusive rule as tournament creation). */
function formatTournamentLengthLabel(startDateStr: string, endDateStr: string): string {
  const days = calendarDaysInclusiveCount(startDateStr, endDateStr);
  if (days === 3) return copy.draftTournament.duration3;
  if (days === 7) return copy.draftTournament.duration7;
  if (days === 14) return copy.draftTournament.duration14;
  if (days === 28) return copy.draftTournament.duration28;
  return fillCopyTemplate(copy.draftTournament.durationDaysTemplate, { days });
}

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'closed';
  join_code: string;
  created_by: string;
}

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
}

export default function DraftTournamentScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { user } = useAuth();
  const { config } = useAppConfig();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  const actionBusy = starting || discarding || leaving || kickingUserId !== null;

  const routeToTournamentDetail = useCallback(
    (tournamentId: string, creatorUserId: string) => {
      const resolvedSource = user?.id === creatorUserId ? 'manage' : 'tournaments';
      router.replace({
        pathname: '/tournament/[id]',
        params: { id: tournamentId, source: resolvedSource },
      });
    },
    [user?.id],
  );

  const loadParticipants = useCallback(async (tournamentId: string) => {
    const { data: participantData } = await supabase
      .from('tournament_participants')
      .select('id, user_id')
      .eq('tournament_id', tournamentId);

    if (!participantData) {
      return;
    }

    const userIds = participantData.map(p => p.user_id);
    if (userIds.length === 0) {
      setParticipants([]);
      return;
    }

    const { data: usersData } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', userIds);

    const usersMap = new Map(usersData?.map(u => [u.id, u.display_name]));

    const formattedParticipants = participantData.map(p => ({
      id: p.id,
      user_id: p.user_id,
      display_name: usersMap.get(p.user_id) || copy.tournamentDetail.unknownPlayer,
    }));

    setParticipants(formattedParticipants);
  }, []);

  const loadTournamentData = async () => {
    if (!id) return;

    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!tournamentData) {
      await loadParticipants(id);
      setLoading(false);
      return;
    }

    if (tournamentData.status !== 'draft') {
      routeToTournamentDetail(tournamentData.id, tournamentData.created_by);
      return;
    }

    setTournament(tournamentData);
    await loadParticipants(id);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadForRouteParam() {
      if (!id) return;

      setLoading(true);
      setTournament(null);
      setParticipants([]);

      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (cancelled) return;

      if (!tournamentData) {
        await loadParticipants(id);
        if (cancelled) return;
        setLoading(false);
        return;
      }

      if (tournamentData.status !== 'draft') {
        routeToTournamentDetail(tournamentData.id, tournamentData.created_by);
        return;
      }

      setTournament(tournamentData);
      await loadParticipants(id);
      if (cancelled) return;
      setLoading(false);
    }

    void loadForRouteParam();

    return () => {
      cancelled = true;
    };
  }, [id, loadParticipants, routeToTournamentDetail]);

  const handleKickParticipant = (participant: Participant) => {
    if (!tournament || participant.user_id === user?.id || actionBusy) return;

    const confirmAndKick = async () => {
      setKickingUserId(participant.user_id);
      try {
        await supabase.rpc('kick_tournament_participant', {
          p_tournament_id: tournament.id,
          p_user_id: participant.user_id,
        });

        await loadParticipants(tournament.id);
      } finally {
        setKickingUserId(null);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(
        fillCopyTemplate(copy.draftTournament.removeWebTemplate, { name: participant.display_name }),
      );
      if (ok) {
        void confirmAndKick();
      }
      return;
    }

    Alert.alert(copy.draftTournament.removeAlertTitle, copy.draftTournament.removeAlertBody, [
      { text: copy.draftTournament.removeAlertCancel, style: 'cancel' },
      {
        text: copy.draftTournament.removeAlertRemove,
        style: 'destructive',
        onPress: () => void confirmAndKick(),
      },
    ]);
  };

  const handleCopyCode = () => {
    if (!tournament) return;

    // Web: use the Clipboard API when available
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tournament.join_code);
      return;
    }

    // Native: no-op for now (could be replaced with expo-clipboard)
  };

  const handleStartTournament = async () => {
    if (!tournament || participants.length < 2 || actionBusy) return;

    setStarting(true);
    const { error } = await supabase.rpc('start_draft_tournament', {
      p_tournament_id: tournament.id,
    });

    setStarting(false);

    if (error) {
      const message = error.message || '';
      if (message.includes('NOT_ENOUGH_PLAYERS')) {
        Alert.alert(
          copy.draftTournament.notEnoughPlayersTitle,
          copy.draftTournament.notEnoughPlayersBody,
        );
        await loadTournamentData();
        return;
      }
      if (message.includes('TOURNAMENT_NOT_DRAFT')) {
        Alert.alert(
          copy.draftTournament.unableStartNotDraftTitle,
          copy.draftTournament.unableStartNotDraftBody,
        );
        await loadTournamentData();
        return;
      }
      if (message.includes('ONLY_CREATOR_CAN_START')) {
        Alert.alert(
          copy.draftTournament.permissionDeniedTitle,
          copy.draftTournament.permissionDeniedBody,
        );
        await loadTournamentData();
        return;
      }

      Alert.alert(
        copy.draftTournament.unableStartGenericTitle,
        copy.draftTournament.unableStartGenericBody,
      );
      await loadTournamentData();
      return;
    }

    router.replace({
      pathname: '/tournament/[id]',
      params: { id: tournament.id, source: 'manage' },
    });
  };

  const handleDiscardTournament = () => {
    if (actionBusy) return;

    setDiscardError(null);
    confirmDiscard(
      copy.draftTournament.discardTitle,
      copy.draftTournament.discardBody,
      async () => {
        if (!tournament || !user?.id) return;
        setDiscarding(true);
        setDiscardError(null);
        const { error } = await supabase.rpc('cancel_tournament_draft', {
          p_tournament_id: tournament.id,
        });
        setDiscarding(false);
        if (error) {
          setDiscardError(error.message || copy.draftTournament.discardFailed);
          return;
        }

        router.replace('/(tabs)/manage');
      }
    );
  };

  const handleLeaveTournament = () => {
    if (!tournament || !user?.id || actionBusy) return;

    const confirmAndLeave = async () => {
      setLeaving(true);
      const { error } = await supabase.rpc('leave_draft_tournament', {
        p_tournament_id: tournament.id,
      });
      setLeaving(false);

      if (error) {
        Alert.alert(
          copy.draftTournament.unableLeaveTitle,
          error.message || copy.draftTournament.unableLeaveGeneric,
        );
        return;
      }

      router.replace('/(tabs)/tournaments');
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(copy.draftTournament.leaveWebConfirm);
      if (ok) {
        void confirmAndLeave();
      }
      return;
    }

    Alert.alert(copy.draftTournament.leaveTitle, copy.draftTournament.leaveBody, [
      { text: copy.draftTournament.removeAlertCancel, style: 'cancel' },
      {
        text: copy.draftTournament.leaveButton,
        style: 'destructive',
        onPress: () => void confirmAndLeave(),
      },
    ]);
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
        <Text>{copy.draftTournament.notFound}</Text>
      </View>
    );
  }

  const canStart = participants.length >= 2;
  const isCreator = user?.id != null && tournament.created_by === user.id;

  const joinCodeSection = (
    <View style={styles.joinCodeRow}>
      <Text style={styles.joinCodeLabel}>Join code </Text>
      <Text style={styles.joinCodeValue}>{tournament.join_code}</Text>
      <TouchableOpacity
        onPress={handleCopyCode}
        style={[styles.copyButton, actionBusy && styles.controlDisabled]}
        disabled={actionBusy}
      >
        <Copy size={18} color="#10b981" />
        <Text style={styles.copyButtonText}>Copy</Text>
      </TouchableOpacity>
    </View>
  );

  const handleBack = () => {
    if (source === 'manage-drafts') {
      router.replace({
        pathname: '/(tabs)/manage',
        params: { view: 'drafts' },
      });
      return;
    }

    if (source === 'manage' || source === 'manage-menu') {
      router.replace('/(tabs)/manage');
      return;
    }

    if (isCreator) {
      router.replace('/(tabs)/manage');
    } else {
      router.replace('/(tabs)/tournaments');
    }
  };

  if (!isCreator) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backButton, actionBusy && styles.controlDisabled]}
            disabled={actionBusy}
          >
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{tournament.name}</Text>
        </View>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
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
          <View style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>{copy.draftTournament.waitingTitle}</Text>
            <Text style={styles.waitingMessage}>{copy.draftTournament.waitingMessageNonCreator}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{copy.draftTournament.tournamentLengthLabel}</Text>
            <Text style={styles.infoValue}>
              {formatTournamentLengthLabel(tournament.start_date, tournament.end_date)}
            </Text>
          </View>
          {joinCodeSection}
          <View style={styles.participantsSection}>
            <View style={styles.participantsHeader}>
              <Users size={24} color="#1a1a1a" />
              <Text style={styles.participantsTitle}>
                {fillCopyTemplate(copy.draftTournament.playersTitleTemplate, {
                  current: participants.length,
                  max: config?.maxParticipantsPerTournament ?? 15,
                })}
              </Text>
            </View>
            {participants.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>{copy.draftTournament.noPlayersYet}</Text>
              </View>
            ) : (
              participants.map(participant => (
                <View key={participant.id} style={styles.participantCard}>
                  <View style={styles.participantAvatar}>
                    <Text style={styles.participantInitial}>
                      {participant.display_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.participantName}>{participant.display_name}</Text>
                </View>
              ))
            )}
          </View>
          <TouchableOpacity
            style={[styles.leaveButton, actionBusy && styles.leaveButtonDisabled]}
            onPress={handleLeaveTournament}
            disabled={actionBusy}
          >
            {leaving ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <Text style={styles.leaveButtonText}>{copy.draftTournament.leaveTournament}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backButton, actionBusy && styles.controlDisabled]}
          disabled={actionBusy}
        >
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{tournament.name}</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
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
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>{copy.draftTournament.tournamentLengthLabel}</Text>
          <Text style={styles.infoValue}>
            {formatTournamentLengthLabel(tournament.start_date, tournament.end_date)}
          </Text>
        </View>

        {joinCodeSection}

        <View style={styles.participantsSection}>
          <View style={styles.participantsHeader}>
            <Users size={24} color="#1a1a1a" />
            <Text style={styles.participantsTitle}>
              {fillCopyTemplate(copy.draftTournament.playersTitleTemplate, {
                current: participants.length,
                max: config?.maxParticipantsPerTournament ?? 15,
              })}
            </Text>
          </View>

          {participants.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{copy.draftTournament.noPlayersYet}</Text>
              <Text style={styles.emptySubtext}>{copy.draftTournament.waitingPlayersSubtext}</Text>
            </View>
          ) : (
            participants.map(participant => (
              <View key={participant.id} style={styles.participantCard}>
                <View style={styles.participantAvatar}>
                  <Text style={styles.participantInitial}>
                    {participant.display_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.participantName}>{participant.display_name}</Text>
                {tournament.status === 'draft' && participant.user_id !== user?.id && (
                  <TouchableOpacity
                    onPress={() => handleKickParticipant(participant)}
                    style={[
                      styles.kickButton,
                      (actionBusy || kickingUserId === participant.user_id) && styles.controlDisabled,
                    ]}
                    disabled={actionBusy}
                  >
                    {kickingUserId === participant.user_id ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Text style={styles.kickButtonText}>×</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {!canStart && participants.length > 0 && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>{copy.draftTournament.needTwoPlayers}</Text>
          </View>
        )}

        
      </ScrollView>

      <View style={styles.footer}>
        {discardError ? (
          <Text style={styles.errorText}>{discardError}</Text>
        ) : null}
        <TouchableOpacity
          style={[
            styles.startButton,
            (!canStart || actionBusy) && styles.startButtonDisabled,
          ]}
          onPress={handleStartTournament}
          disabled={!canStart || actionBusy}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Play size={20} color="#fff" />
              <Text style={styles.startButtonText}>{copy.draftTournament.startButton}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.discardButton, actionBusy && styles.controlDisabled]}
          onPress={handleDiscardTournament}
          disabled={actionBusy}
        >
          {discarding ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <>
              <Trash2 size={20} color="#ef4444" />
              <Text style={styles.discardButtonText}>{copy.draftTournament.discardButton}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = createStyles({
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
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
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
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  waitingCard: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 8,
  },
  waitingMessage: {
    fontSize: 14,
    color: '#0c4a6e',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  joinCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  joinCodeLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  joinCodeValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: 2,
    flex: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  participantsSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  participantsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  participantName: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  kickButton: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  kickButtonText: {
    fontSize: 20,
    color: '#ef4444',
    fontWeight: '700',
  },
  warningCard: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.6,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: 'transparent',
  },
  discardButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  leaveButton: {
    borderWidth: 2,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  leaveButtonDisabled: {
    opacity: 0.7,
  },
  controlDisabled: {
    opacity: 0.5,
  },
  leaveButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
