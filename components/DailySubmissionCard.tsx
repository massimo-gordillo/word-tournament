import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors } from '@/constants/colors';
import { formatDateOrToday } from '@/lib/dateUtils';

type Variant = 'screen' | 'chat';

type Props = {
  variant?: Variant;
  dateLabel?: string;
  playerName?: string;
  didSubmit: boolean;
  score?: number;
  submissionText?: string; // normalized B/Y/G grid
};

export function DailySubmissionCard({
  variant = 'screen',
  dateLabel,
  playerName,
  didSubmit,
  score,
  submissionText,
}: Props) {
  const renderWordGrid = (text: string) => {
    const lines = text.split('\n');
    const gridLines = lines
      .map(rawLine => rawLine.replace(/[^BYG]/g, ''))
      .filter(line => line.length > 0);

    return (
      <View style={styles.wordGrid}>
        {gridLines.map((line, index) => (
          <Text
            key={index}
            style={styles.wordRow}
            selectable={variant === 'chat'}
          >
            {line
              .split('')
              .map(ch => (ch === 'G' ? '🟩' : ch === 'Y' ? '🟨' : '⬜'))
              .join('')}
          </Text>
        ))}
      </View>
    );
  };

  const isChat = variant === 'chat';

  return (
    <View style={[styles.container, isChat ? styles.containerChat : styles.containerScreen]}>
      <View style={[styles.card, isChat ? styles.cardChat : styles.cardScreen]}>
        <View style={styles.headerRow}>
          {playerName ? (
            <Text style={styles.nameText}>{playerName}</Text>
          ) : (
            <Text style={styles.nameText}>Today</Text>
          )}
          <Text style={styles.statusText}>
            {typeof score === 'number' ? `${score} pts` : ''}
          </Text>
        </View>
        {!didSubmit && <Text style={styles.statusText}>No submission (-2)</Text>}
        {didSubmit && submissionText ? renderWordGrid(submissionText) : null}
        {dateLabel ? <Text style={styles.dateLabel}>{formatDateOrToday(dateLabel)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  containerScreen: {
    paddingHorizontal: 64,
  },
  containerChat: {
    paddingHorizontal: 0,
    width: '100%',
    maxWidth: '100%',
  },
  card: {
    backgroundColor: AppColors.background.surface,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  cardScreen: {
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardChat: {
    marginBottom: 0,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: AppColors.status.neutral,
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text.primary,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.text.body,
  },
  wordGrid: {
    marginTop: 0,
    marginBottom: 6,
    alignItems: 'center',
    margin: 16,
  },
  wordRow: {
    fontSize: 20,
    marginBottom: 0,
    lineHeight: 18,
    letterSpacing: -6,
    textAlign: 'left',
  },
});
