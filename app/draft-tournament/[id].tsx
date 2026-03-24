import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, RefreshControl, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Users, Copy, Play, Trash2 } from 'lucide-react-native';
import { useAppConfig } from '@/contexts/ConfigContext';

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
    { text: 'Keep draft', style: 'cancel', onPress: onCancel },
    { text: 'Discard', style: 'destructive', onPress: () => void Promise.resolve(onConfirm()) },
  ]);
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
  const { id } = useLocalSearchParams();
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

  useEffect(() => {
    loadTournamentData();
  }, []);

  const loadTournamentData = async () => {
    if (!id) return;

    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!tournamentData) {
      await loadParticipants();
      setLoading(false);
      return;
    }

    setTournament(tournamentData);
    await loadParticipants();
    setLoading(false);
  };

  const loadParticipants = async () => {
    if (!id) return;

    const { data: participantData } = await supabase
      .from('tournament_participants')
      .select('id, user_id')
      .eq('tournament_id', id);

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
      display_name: usersMap.get(p.user_id) || 'Unknown',
    }));

    setParticipants(formattedParticipants);
  };

  const handleKickParticipant = (participant: Participant) => {
    if (!tournament || participant.user_id === user?.id) return;

    const confirmAndKick = async () => {
      await supabase.rpc('kick_tournament_participant', {
        p_tournament_id: tournament.id,
        p_user_id: participant.user_id,
      });

      await loadParticipants();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(
        `Remove ${participant.display_name} from this tournament?\n\nThey will not be able to re-join.`,
      );
      if (ok) {
        void confirmAndKick();
      }
      return;
    }

    Alert.alert(
      'Remove player',
      'Remove this player from the tournament? They will not be able to re-join.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void confirmAndKick() },
      ],
    );
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
    if (!tournament || participants.length < 2) return;

    setStarting(true);
    const { error } = await supabase.rpc('start_draft_tournament', {
      p_tournament_id: tournament.id,
    });

    setStarting(false);

    if (error) {
      const message = error.message || '';
      if (message.includes('NOT_ENOUGH_PLAYERS')) {
        Alert.alert(
          'Not enough players',
          'At least 2 players must still be in the tournament to start it.',
        );
        await loadTournamentData();
        return;
      }
      if (message.includes('TOURNAMENT_NOT_DRAFT')) {
        Alert.alert('Unable to start', 'This tournament is no longer in draft status.');
        await loadTournamentData();
        return;
      }
      if (message.includes('ONLY_CREATOR_CAN_START')) {
        Alert.alert('Permission denied', 'Only the tournament creator can start this tournament.');
        await loadTournamentData();
        return;
      }

      Alert.alert('Unable to start tournament', 'Please refresh and try again.');
      await loadTournamentData();
      return;
    }

    router.replace(`/tournament/${tournament.id}`);
  };

  const handleDiscardTournament = () => {
    setDiscardError(null);
    confirmDiscard(
      'Discard tournament',
      'This will cancel the tournament and remove it from your drafts. This cannot be undone.',
      async () => {
        if (!tournament || !user?.id) return;
        setDiscarding(true);
        setDiscardError(null);
        const { error } = await supabase.rpc('cancel_tournament_draft', {
          p_tournament_id: tournament.id,
        });
        setDiscarding(false);
        if (error) {
          setDiscardError(error.message || 'Failed to discard tournament');
          return;
        }

        router.replace('/(tabs)/manage');
      }
    );
  };

  const handleLeaveTournament = () => {
    if (!tournament || !user?.id) return;

    const confirmAndLeave = async () => {
      setLeaving(true);
      const { error } = await supabase.rpc('leave_draft_tournament', {
        p_tournament_id: tournament.id,
      });
      setLeaving(false);

      if (error) {
        Alert.alert('Unable to leave', error.message || 'Could not leave this tournament.');
        return;
      }

      router.replace('/(tabs)/tournaments');
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm('Leave this draft tournament?');
      if (ok) {
        void confirmAndLeave();
      }
      return;
    }

    Alert.alert(
      'Leave tournament',
      'Are you sure you want to leave this draft tournament?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => void confirmAndLeave() },
      ],
    );
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

  const canStart = participants.length >= 2;
  const isCreator = user?.id != null && tournament.created_by === user.id;

  const handleBack = () => {
    if (router.canGoBack && router.canGoBack()) {
      router.back();
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
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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
            <Text style={styles.waitingTitle}>Waiting</Text>
            <Text style={styles.waitingMessage}>
              You're in this tournament. The host will start it when everyone is ready.
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Tournament length</Text>
            <Text style={styles.infoValue}>
              {(() => {
                const start = new Date(tournament.start_date);
                const end = new Date(tournament.end_date);
                const days =
                  Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                if (days === 3) return '3 days';
                if (days === 7) return '7 days';
                if (days === 14) return '2 weeks';
                if (days === 28) return '4 weeks';
                return `${days} days`;
              })()}
            </Text>
          </View>
          <View style={styles.participantsSection}>
            <View style={styles.participantsHeader}>
              <Users size={24} color="#1a1a1a" />
              <Text style={styles.participantsTitle}>
                Players ({participants.length}/{config?.maxParticipantsPerTournament ?? 15})
              </Text>
            </View>
            {participants.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No players yet</Text>
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
            style={[styles.leaveButton, leaving && styles.leaveButtonDisabled]}
            onPress={handleLeaveTournament}
            disabled={leaving}
          >
            {leaving ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <Text style={styles.leaveButtonText}>Leave Tournament</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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
          <Text style={styles.infoLabel}>Tournament length</Text>
          <Text style={styles.infoValue}>
            {(() => {
              const start = new Date(tournament.start_date);
              const end = new Date(tournament.end_date);
              const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
              if (days === 3) return '3 days';
              if (days === 7) return '7 days';
              if (days === 14) return '2 weeks';
              if (days === 28) return '4 weeks';
              return `${days} days`;
            })()}
          </Text>
        </View>

        <View style={styles.joinCodeRow}>
          <Text style={styles.joinCodeLabel}>Join code </Text>
          <Text style={styles.joinCodeValue}>{tournament.join_code}</Text>
          <TouchableOpacity onPress={handleCopyCode} style={styles.copyButton}>
            <Copy size={18} color="#10b981" />
            <Text style={styles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.participantsSection}>
          <View style={styles.participantsHeader}>
            <Users size={24} color="#1a1a1a" />
            <Text style={styles.participantsTitle}>
              Players ({participants.length}/{config?.maxParticipantsPerTournament ?? 15})
            </Text>
          </View>

          {participants.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No players yet</Text>
              <Text style={styles.emptySubtext}>Waiting for players to join...</Text>
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
                    style={styles.kickButton}
                  >
                    <Text style={styles.kickButtonText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {!canStart && participants.length > 0 && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              You need at least 2 players to start the tournament
            </Text>
          </View>
        )}

        
      </ScrollView>

      <View style={styles.footer}>
        {discardError ? (
          <Text style={styles.errorText}>{discardError}</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.startButton, !canStart && styles.startButtonDisabled]}
          onPress={handleStartTournament}
          disabled={!canStart || starting}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Play size={20} color="#fff" />
              <Text style={styles.startButtonText}>Start tournament</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.discardButton}
          onPress={handleDiscardTournament}
          disabled={discarding}
        >
          {discarding ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <>
              <Trash2 size={20} color="#ef4444" />
              <Text style={styles.discardButtonText}>Discard tournament</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  leaveButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
