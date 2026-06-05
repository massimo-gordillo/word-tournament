import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { AppColors } from '@/constants/colors';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Plus, FileText, History, ChevronDown } from 'lucide-react-native';
import { useAppConfig } from '@/contexts/ConfigContext';
import { devLog } from '@/utils/logger';
import { formatDateShort } from '@/lib/dateUtils';
import { TournamentListItem } from '@/components/TournamentListItem';
import { copy, fillCopyTemplate } from '@/app/copy/strings';

interface Tournament {
  id: string;
  name: string;
  created_by: string;
  start_date: string;
  end_date: string;
  duration: number;
  status: 'draft' | 'active' | 'closed';
  join_code: string;
  created_at: string;
}

/** Past list item: tournament plus whether the current user forfeited it */
type PastTournamentItem = { tournament: Tournament; iForfeited: boolean };

type DurationOption = {
  label: string;
  days: number;
};

function getDurationOptions(): DurationOption[] {
  return [
    { label: copy.manage.duration3, days: 3 },
    { label: copy.manage.duration7, days: 7 },
    { label: copy.manage.duration14, days: 14 },
    { label: copy.manage.duration28, days: 28 },
  ];
}

export default function ManageTournamentsScreen() {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const { reset, view } = useLocalSearchParams<{ reset?: string; view?: string }>();
  const [activeView, setActiveView] = useState<'menu' | 'drafts' | 'past'>('menu');
  const [draftTournaments, setDraftTournaments] = useState<Tournament[]>([]);
  const [pastTournaments, setPastTournaments] = useState<PastTournamentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const [duration, setDuration] = useState<DurationOption>(() => getDurationOptions()[0]);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [refreshingDrafts, setRefreshingDrafts] = useState(false);
  const [refreshingPast, setRefreshingPast] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [limitQuantity, setLimitQuantity] = useState(4);
  const [wonTournamentIds, setWonTournamentIds] = useState<Set<string>>(new Set());
  const [menuPending, setMenuPending] = useState<'create' | 'drafts' | 'past' | null>(null);

  const menuInteractionBlocked = saving || menuPending !== null;

  useEffect(() => {
    loadUserDisplayName();
  }, [user]);

  useEffect(() => {
    setActiveView('menu');
    setCreateModalVisible(false);
    setShowDurationPicker(false);
  }, [reset]);

  useEffect(() => {
    if (view === 'drafts') {
      setActiveView('drafts');
      void loadDraftTournaments();
      return;
    }
    if (view === 'past') {
      setActiveView('past');
      void loadPastTournaments();
    }
  }, [view]);

  const loadUserDisplayName = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!data) {
      return;
    }

    setUserDisplayName(data.display_name);
  };

  const loadDraftTournaments = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('created_by', user.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    setDraftTournaments(data);
    setLoading(false);
  };

  const loadPastTournaments = async () => {
    if (!user) return;
    setLoading(true);

    const { data: participations } = await supabase
      .from('tournament_participants')
      .select('tournament_id, forfeited')
      .eq('user_id', user.id);

    const tournamentIds = participations?.map(p => p.tournament_id) ?? [];
    const forfeitedByTournamentId = new Map(
      participations?.map(p => [p.tournament_id, p.forfeited === true]) ?? [],
    );

    if (tournamentIds.length === 0) {
      setPastTournaments([]);
      setWonTournamentIds(new Set());
      setLoading(false);
      return;
    }

    const { data: tournamentsData, error } = await supabase
      .from('tournaments')
      .select('*')
      .in('id', tournamentIds)
      .in('status', ['active', 'closed'])
      .order('created_at', { ascending: false });

    if (error) {
      setPastTournaments([]);
      setLoading(false);
      return;
    }

    const { data: winnersData } = await supabase
      .from('tournament_winners')
      .select('tournament_id')
      .eq('user_id', user.id)
      .in('tournament_id', tournamentIds);

    setWonTournamentIds(new Set((winnersData ?? []).map(w => w.tournament_id)));

    const items: PastTournamentItem[] = (tournamentsData ?? [])
      .filter(t => t.status === 'closed' || forfeitedByTournamentId.get(t.id))
      .map(t => ({
        tournament: t as Tournament,
        iForfeited: forfeitedByTournamentId.get(t.id) ?? false,
      }))
      .sort(
        (a, b) =>
          new Date(b.tournament.created_at).getTime() - new Date(a.tournament.created_at).getTime(),
      );

    setPastTournaments(items);
    setLoading(false);
  };

  const handleRefreshDrafts = async () => {
    setRefreshingDrafts(true);
    await loadDraftTournaments();
    setRefreshingDrafts(false);
  };

  const handleRefreshPast = async () => {
    setRefreshingPast(true);
    await loadPastTournaments();
    setRefreshingPast(false);
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

    devLog('Create tournament blocked by limit', {
      currentTournaments: current,
      maxTournamentsAllowed: max,
      appConfig: config,
    });
    setLimitQuantity(max);
    setLimitModalVisible(true);
  };

  const handleCreateTournament = async () => {
    if (!userDisplayName) {
      setError(copy.manage.loadUserError);
      return;
    }

    setSaving(true);
    setError('');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    // Duration is inclusive of start day: e.g. 3 days starting Mar 11 → end Mar 13 (submit on 11, 12, 13)
    endDate.setDate(endDate.getDate() + duration.days - 1);

    const tournamentName = fillCopyTemplate(copy.manage.defaultTournamentNameTemplate, {
      name: userDisplayName,
    });

    const startDateStr = today.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const { data: tournamentId, error: createError } = await supabase.rpc('create_tournament_draft', {
      p_name: tournamentName,
      p_start_date: startDateStr,
      p_end_date: endDateStr,
    });

    if (createError) {
      setSaving(false);
      const message = createError.message || copy.manage.createGenericError;
      if (message.includes('maximum number of tournaments')) {
        const max = config?.maxTournamentsPerUser ?? 4;
        setError(fillCopyTemplate(copy.manage.maxTournamentsError, { max }));
        return;
      }
      setError(message);
      return;
    }

    setSaving(false);
    setCreateModalVisible(false);
    setDuration(getDurationOptions()[0]);
    router.push({
      pathname: '/draft-tournament/[id]',
      params: { id: tournamentId, source: 'manage-menu' },
    });
  };

  const handleMenuCreate = async () => {
    if (menuInteractionBlocked) return;

    setMenuPending('create');
    try {
      await checkTournamentLimitAndMaybe(() => setCreateModalVisible(true));
    } finally {
      setMenuPending(null);
    }
  };

  const handleMenuDrafts = async () => {
    if (menuInteractionBlocked) return;

    setMenuPending('drafts');
    try {
      await loadDraftTournaments();
      setActiveView('drafts');
    } finally {
      setMenuPending(null);
    }
  };

  const handleMenuPast = async () => {
    if (menuInteractionBlocked) return;

    setMenuPending('past');
    try {
      await loadPastTournaments();
      setActiveView('past');
    } finally {
      setMenuPending(null);
    }
  };

  const renderMenuCard = (
    action: 'create' | 'drafts' | 'past',
    onPress: () => void,
    iconBackgroundColor: string,
    Icon: typeof Plus,
    title: string,
    subtitle: string,
  ) => {
    const isPending = menuPending === action;

    return (
      <TouchableOpacity
        key={action}
        style={[styles.menuCard, menuInteractionBlocked && styles.menuCardDisabled]}
        onPress={onPress}
        disabled={menuInteractionBlocked}
      >
        <View style={[styles.menuIconContainer, { backgroundColor: iconBackgroundColor }]}>
          {isPending ? (
            <ActivityIndicator size="large" color={AppColors.text.inverse} />
          ) : (
            <Icon size={32} color={AppColors.text.inverse} />
          )}
        </View>
        <Text style={styles.menuCardTitle}>{title}</Text>
        <Text style={styles.menuCardSubtitle}>{subtitle}</Text>
      </TouchableOpacity>
    );
  };

  const renderMenu = () => (
    <ScrollView style={styles.content}>
      <View style={styles.menuGrid}>
        {renderMenuCard(
          'create',
          () => void handleMenuCreate(),
          AppColors.brand.primary,
          Plus,
          copy.manage.createTitle,
          copy.manage.createSubtitle,
        )}
        {renderMenuCard(
          'drafts',
          () => void handleMenuDrafts(),
          AppColors.status.warning,
          FileText,
          copy.manage.draftsTitle,
          copy.manage.draftsSubtitle,
        )}
        {renderMenuCard(
          'past',
          () => void handleMenuPast(),
          AppColors.status.neutral,
          History,
          copy.manage.pastTitle,
          copy.manage.pastSubtitle,
        )}
      </View>
    </ScrollView>
  );

  const renderDrafts = () => (
    <ScrollView
      style={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshingDrafts} onRefresh={handleRefreshDrafts} />
      }
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setActiveView('menu')}
      >
        <Text style={styles.backButtonText}>{copy.manage.backToMenu}</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={AppColors.brand.primary} style={{ marginTop: 40 }} />
      ) : draftTournaments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{copy.manage.emptyDraftsTitle}</Text>
          <Text style={styles.emptySubtext}>{copy.manage.emptyDraftsSubtext}</Text>
        </View>
      ) : (
        draftTournaments.map(tournament => {
          const start = new Date(tournament.start_date);
          const end = new Date(tournament.end_date);
          const calendarDays =
            Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          return (
            <TournamentListItem
              key={tournament.id}
              title={tournament.created_by === user?.id ? copy.manage.yourTournament : tournament.name}
              statusLabel={copy.manage.draftStatus}
              statusColor={AppColors.status.warning}
              durationLabel={calendarDays.toString()}
              secondaryText={`${copy.manage.joinCodeSecondaryPrefix}${tournament.join_code}`}
              onPress={() =>
                router.push({
                  pathname: '/draft-tournament/[id]',
                  params: { id: tournament.id, source: 'manage-drafts' },
                })
              }
            />
          );
        })
      )}
    </ScrollView>
  );

  const renderPast = () => (
    <ScrollView
      style={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshingPast} onRefresh={handleRefreshPast} />
      }
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setActiveView('menu')}
      >
        <Text style={styles.backButtonText}>{copy.manage.backToMenu}</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={AppColors.brand.primary} style={{ marginTop: 40 }} />
      ) : pastTournaments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{copy.manage.emptyPastTitle}</Text>
          <Text style={styles.emptySubtext}>{copy.manage.emptyPastSubtext}</Text>
        </View>
      ) : (
        pastTournaments.map(({ tournament, iForfeited }) => {
          const start = new Date(tournament.start_date);
          const end = new Date(tournament.end_date);
          const calendarDays =
            Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const showForfeitedLabel = iForfeited && tournament.status === 'active';

          return (
            <TournamentListItem
              key={tournament.id}
              title={tournament.created_by === user?.id ? copy.manage.yourTournament : tournament.name}
              showWinnerTrophy={wonTournamentIds.has(tournament.id)}
              statusLabel={showForfeitedLabel ? copy.manage.forfeitedStatus : copy.manage.closedStatus}
              statusColor={showForfeitedLabel ? AppColors.status.error : AppColors.status.neutral}
              durationLabel={calendarDays.toString()}
              endDateLabel={formatDateShort(tournament.end_date)}
              onPress={() =>
                router.push({
                  pathname: '/tournament/[id]',
                  params: { id: tournament.id, source: 'manage' },
                })
              }
            />
          );
        })
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{copy.manage.headerTitle}</Text>
      </View>

      {activeView === 'menu' && renderMenu()}
      {activeView === 'drafts' && renderDrafts()}
      {activeView === 'past' && renderPast()}

      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!saving) {
            setCreateModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{copy.manage.modalCreateTitle}</Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>{copy.manage.tournamentNameLabel}</Text>
              <Text style={styles.infoBoxValue}>
                {userDisplayName
                  ? fillCopyTemplate(copy.manage.defaultTournamentNameTemplate, { name: userDisplayName })
                  : copy.manage.loadingTournamentName}
              </Text>
            </View>

            <Text style={styles.inputLabel}>{copy.manage.durationLabel}</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowDurationPicker(!showDurationPicker)}
              disabled={saving}
            >
              <Text style={styles.dropdownButtonText}>{duration.label}</Text>
              <ChevronDown size={20} color={AppColors.text.muted} />
            </TouchableOpacity>

            {showDurationPicker && (
              <View style={styles.dropdownList}>
                {getDurationOptions().map((option) => (
                  <TouchableOpacity
                    key={option.days}
                    style={[
                      styles.dropdownItem,
                      option.days === duration.days && styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      setDuration(option);
                      setShowDurationPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        option.days === duration.days && styles.dropdownItemTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxLabel}>{copy.manage.startDateLabel}</Text>
              <Text style={styles.infoBoxValue}>{copy.manage.startDateValue}</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setCreateModalVisible(false);
                  setDuration(getDurationOptions()[0]);
                  setShowDurationPicker(false);
                  setError('');
                }}
                disabled={saving}
              >
                <Text style={styles.modalButtonTextCancel}>{copy.manage.cancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave, saving && styles.buttonDisabled]}
                onPress={handleCreateTournament}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={AppColors.text.inverse} />
                ) : (
                  <Text style={styles.modalButtonTextSave}>{copy.manage.create}</Text>
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
            <Text style={styles.modalTitle}>{copy.manage.limitModalTitle}</Text>
            <Text style={styles.limitMessage}>
              {fillCopyTemplate(copy.manage.limitModalBody, { max: limitQuantity })}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setLimitModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>{copy.manage.ok}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = createStyles({
  container: {
    flex: 1,
    backgroundColor: AppColors.background.app,
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
    padding: 8,
  },
  menuGrid: {
    gap: 16,
  },
  menuCard: {
    backgroundColor: AppColors.background.surface,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuCardDisabled: {
    opacity: 0.5,
  },
  menuIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuCardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: AppColors.text.primary,
    marginBottom: 4,
  },
  menuCardSubtitle: {
    fontSize: 14,
    color: AppColors.text.muted,
    textAlign: 'center',
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: AppColors.brand.primary,
    fontWeight: '500',
  },
  tournamentCard: {
    backgroundColor: AppColors.background.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: AppColors.shadow,
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
    color: AppColors.text.primary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: AppColors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  tournamentDate: {
    fontSize: 14,
    color: AppColors.text.muted,
    marginBottom: 4,
  },
  joinCodeText: {
    fontSize: 14,
    color: AppColors.brand.primary,
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
    color: AppColors.text.primary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: AppColors.text.muted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: AppColors.overlay.dark,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: AppColors.background.surface,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.text.primary,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: AppColors.text.muted,
    marginBottom: 8,
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: AppColors.background.input,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.background.neutral,
  },
  infoBoxLabel: {
    fontSize: 12,
    color: AppColors.text.muted,
    marginBottom: 4,
    fontWeight: '500',
  },
  infoBoxValue: {
    fontSize: 16,
    color: AppColors.text.primary,
    fontWeight: '600',
  },
  dropdownButton: {
    backgroundColor: AppColors.background.input,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: AppColors.background.neutral,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: AppColors.text.primary,
  },
  dropdownList: {
    backgroundColor: AppColors.background.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.background.neutral,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.background.neutral,
  },
  dropdownItemSelected: {
    backgroundColor: AppColors.background.successTint,
  },
  dropdownItemText: {
    fontSize: 16,
    color: AppColors.text.primary,
  },
  dropdownItemTextSelected: {
    color: AppColors.brand.primary,
    fontWeight: '600',
  },
  error: {
    color: AppColors.status.error,
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: AppColors.background.subtle,
  },
  modalButtonSave: {
    backgroundColor: AppColors.brand.primary,
  },
  modalButtonTextCancel: {
    color: AppColors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    color: AppColors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  limitMessage: {
    fontSize: 14,
    color: AppColors.text.body,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
