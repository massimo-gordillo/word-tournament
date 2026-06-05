import React from 'react';
import { TouchableOpacity, View, Text, GestureResponderEvent } from 'react-native';
import { createStyles } from '@/lib/createStyles';
import { AppColors } from '@/constants/colors';

type Props = {
  title: string;
  showWinnerTrophy?: boolean;
  statusLabel: string;
  statusColor: string;
  durationLabel: string;
  endDateLabel?: string;
  secondaryText?: string;
  onPress: (event: GestureResponderEvent) => void;
};

export function TournamentListItem({
  title,
  showWinnerTrophy = false,
  statusLabel,
  statusColor,
  durationLabel,
  endDateLabel,
  secondaryText,
  onPress,
}: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}{showWinnerTrophy ? ' 🏆' : ''}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.dateText}>{`Duration: ${durationLabel} ${durationLabel === "1" ? 'day' : 'days'}`}</Text>

     {endDateLabel ? (
        <Text style={styles.dateText}>{`${statusLabel === 'Closed' ? 'Ended on:' : 'Ends:'} ${endDateLabel}`}</Text>
        ) : null}
      {secondaryText ? <Text style={styles.secondaryText}>{secondaryText}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = createStyles({
  card: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text.primary,
    flex: 1,
    marginRight: 8,
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
  dateText: {
    fontSize: 14,
    color: AppColors.text.muted,
    marginBottom: 4,
  },
  secondaryText: {
    fontSize: 14,
    color: AppColors.brand.primary,
    fontWeight: '500',
  },
});

