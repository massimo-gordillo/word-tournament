import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, GestureResponderEvent } from 'react-native';

type Props = {
  title: string;
  statusLabel: string;
  statusColor: string;
  durationLabel: string;
  endDateLabel?: string;
  secondaryText?: string;
  onPress: (event: GestureResponderEvent) => void;
};

export function TournamentListItem({
  title,
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
          {title}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.dateText}>{`Duration: ${durationLabel} ${durationLabel === "1" ? 'day' : 'days'}`}</Text>

     {endDateLabel ? <Text style={styles.dateText}>{`Ends: ${formatDate(endDateLabel)}`}</Text> : null}
      {secondaryText ? <Text style={styles.secondaryText}>{secondaryText}</Text> : null}
    </TouchableOpacity>
  );
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  })
}

const styles = StyleSheet.create({
  card: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
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
  dateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  secondaryText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
});

