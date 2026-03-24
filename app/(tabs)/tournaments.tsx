import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useAppConfig } from '@/contexts/ConfigContext';
import { TournamentListItem } from '@/components/TournamentListItem';
import { Search } from 'lucide-react-native';
import { formatDateShort } from '@/lib/dateUtils';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'closed' | 'cancelled';
  created_by: string;
  join_code: string;
}

export default function OngoingTournamentsScreen() {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [forfeitedTournamentIds, setForfeitedTournamentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joiningTournament, setJoiningTournament] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [limitQuantity, setLimitQuantity] = useState(4);
  const [showOngoing, setShowOngoing] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    loadTournaments();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) loadTournaments();
    }, [user]),
  );

  const loadTournaments = async () => {
    if (!user) return;

    const { data: participantData } = await supabase
      .from('tournament_participants')
      .select('tournament_id, forfeited')
      .eq('user_id', user.id);

    const tournamentIds = participantData?.map(p => p.tournament_id) || [];
    const forfeitedIds = new Set(
      participantData?.filter(p => p.forfeited).map(p => p.tournament_id) ?? [],
    );
    setForfeitedTournamentIds(forfeitedIds);

    if (tournamentIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .in('id', tournamentIds)
      .in('status', ['draft', 'active', 'closed'])
      .order('created_at', { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    setTournaments(data);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTournaments();
    setRefreshing(false);
  };

  const checkTournamentLimitAndMaybe = async (onAllowed: () => void) => {
    if (!user) return;

    const { data, error } = await supabase.rpc('get_tournament_limit_info');

    if (error || !data || data.length === 0) {
      onAllowed();
      return;
    }

    const current = (data[0] as any).current_count ?? 0;
    const max = (data[0] as any).max_limit ?? 4;

    if (current < max) {
      onAllowed();
      return;
    }

    setLimitQuantity(max);
    setLimitModalVisible(true);
  };

  const handleJoinTournament = async () => {
    if (!joinCode.trim()) {
      setJoinError('Please enter a join code');
      return;
    }

    setJoiningTournament(true);
    setJoinError('');

    const { data, error } = await supabase.rpc('join_tournament_by_code', {
      p_join_code: joinCode.toUpperCase(),
    });

    setJoiningTournament(false);

    if (error) {
      const message = error.message || 'Unable to join tournament';
      if (message.includes('already in this tournament')) {
        setJoinError('You are already in this tournament');
        return;
      }
      if (message.includes('maximum number of tournaments')) {
        const max = config?.maxTournamentsPerUser ?? 4;
        setJoinError(`You are already in the maximum number of tournaments (${max})`);
        return;
      }
      if (message.includes('tournament is full')) {
        const maxPlayers = config?.maxParticipantsPerTournament ?? 15;
        setJoinError(`This tournament is full (${maxPlayers} players max)`);
        return;
      }
      if (message.includes('Invalid or inactive join code')) {
        setJoinError('Invalid join code');
        return;
      }
      setJoinError(message);
      return;
    }

    setJoinModalVisible(false);
    setJoinCode('');
    loadTournaments();
  };

  const getStatusColor = (status: string, isCreator?: boolean) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'closed':
        return '#6b7280';
      case 'draft':
        return '#f59e0b';
        // Creator: Draft, Participant: Joined
        //return isCreator ? '#f59e0b' : '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (tournament: Tournament) => {
    if (tournament.status === 'active') return 'Active';
    if (tournament.status === 'closed') return 'Closed';
    if (tournament.status === 'draft') {
      return tournament.created_by === user?.id ? 'Draft' : 'Joined';
    }
    return tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1);
  };

  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const joinedDraftTournaments = tournaments.filter(
    t => t.status === 'draft' && t.created_by !== user?.id,
  );
  const ongoingTournaments = tournaments.filter(
    t => t.status === 'active' && !forfeitedTournamentIds.has(t.id),
  );
  const totalOngoingCount = joinedDraftTournaments.length + ongoingTournaments.length;
  const recentlyCompletedTournaments = tournaments.filter(t => {
    if (t.status !== 'closed' || forfeitedTournamentIds.has(t.id)) return false;
    const end = new Date(t.end_date);
    return now.getTime() - end.getTime() < sevenDaysMs;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Joined Tournaments</Text>
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => {
            void checkTournamentLimitAndMaybe(() => setJoinModalVisible(true));
          }}
        >
          <Search size={20} color="#fff" />
          <Text style={styles.joinButtonText}>Join by Code</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <ActivityIndicator color="#10b981" style={{ marginTop: 40 }} />
        ) : (
          <>
            {totalOngoingCount === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No joined tournaments</Text>
                <Text style={styles.emptySubtext}>
                  Join a tournament using a code
                </Text>
              </View>
            ) : null}

            {totalOngoingCount > 0 && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setShowOngoing(prev => !prev)}
                >
                  <Text style={styles.sectionHeaderText}>
                    Ongoing Tournaments ({totalOngoingCount})
                  </Text>
                  <Text style={styles.sectionHeaderChevron}>{showOngoing ? '˄' : '˅'}</Text>
                </TouchableOpacity>
                <View style={styles.sectionDivider} />
                {showOngoing &&
                  [...joinedDraftTournaments, ...ongoingTournaments].map(tournament => {
                    const start = new Date(tournament.start_date);
                    const end = new Date(tournament.end_date);
                    const calendarDays =
                      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const durationLabel = calendarDays.toString();
                    const endDateLabel = formatDateShort(end);

                    return (
                      <TournamentListItem
                        key={tournament.id}
                        title={
                          tournament.created_by === user?.id
                            ? 'Your Tournament'
                            : tournament.name
                        }
                        statusLabel={getStatusText(tournament)}
                        statusColor={getStatusColor(
                          tournament.status,
                          tournament.created_by === user?.id,
                        )}
                        durationLabel={durationLabel}
                        endDateLabel={endDateLabel}
                        secondaryText={`Code: ${tournament.join_code}`}
                        onPress={() => router.push(`/tournament/${tournament.id}`)}
                      />
                    );
                  })}
              </View>
            )}

            {recentlyCompletedTournaments.length > 0 && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setShowCompleted(prev => !prev)}
                >
                  <Text style={styles.sectionHeaderText}>
                    Recently Completed Tournaments ({recentlyCompletedTournaments.length})
                  </Text>
                  <Text style={styles.sectionHeaderChevron}>{showCompleted ? '˄' : '˅'}</Text>
                </TouchableOpacity>
                <View style={styles.sectionDivider} />
                {showCompleted &&
                  recentlyCompletedTournaments.map(tournament => {
                    const start = new Date(tournament.start_date);
                    const end = new Date(tournament.end_date);
                    const calendarDays =
                      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const durationLabel = calendarDays.toString();
                    const endDateLabel = formatDateShort(end);

                    return (
                      <TournamentListItem
                        key={tournament.id}
                        title={
                          tournament.created_by === user?.id
                            ? 'Your Tournament'
                            : tournament.name
                        }
                        statusLabel={getStatusText(tournament)}
                        statusColor={getStatusColor(
                          tournament.status,
                          tournament.created_by === user?.id,
                        )}
                        durationLabel={durationLabel}
                        endDateLabel={endDateLabel}
                        secondaryText={`Code: ${tournament.join_code}`}
                        onPress={() => router.push(`/tournament/${tournament.id}`)}
                      />
                    );
                  })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Tournament</Text>
            <Text style={styles.modalSubtitle}>Enter the tournament join code</Text>

            <TextInput
              style={styles.input}
              placeholder="Join Code (e.g., ABC123)"
              placeholderTextColor="#999"
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
              editable={!joiningTournament}
            />

            {joinError ? <Text style={styles.error}>{joinError}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setJoinModalVisible(false);
                  setJoinCode('');
                  setJoinError('');
                }}
                disabled={joiningTournament}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonJoin, joiningTournament && styles.buttonDisabled]}
                onPress={handleJoinTournament}
                disabled={joiningTournament}
              >
                {joiningTournament ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextJoin}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={limitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLimitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tournament limit reached</Text>
            <Text style={styles.modalSubtitle}>
              You have hit your limit of {limitQuantity} continuous tournaments. Delete a draft tournament
              you've created, leave a tournament, or wait for an ongoing tournament to complete.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setLimitModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  sectionHeaderChevron: {
    fontSize: 18,
    color: '#6b7280',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  tournamentCard: {
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
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tournamentDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  joinCodeText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonJoin: {
    backgroundColor: '#10b981',
  },
  modalButtonTextCancel: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextJoin: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
