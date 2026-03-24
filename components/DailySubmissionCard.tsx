import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDateOrToday } from '@/utils/dateUtils';

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
  const renderWordleGrid = (text: string) => {
    const lines = text.split('\n');
    const gridLines = lines
      .map(rawLine => rawLine.replace(/[^BYG]/g, ''))
      .filter(line => line.length > 0);

    return (
      <View style={styles.wordleGrid}>
        {gridLines.map((line, index) => (
          <Text
            key={index}
            style={styles.wordleRow}
            selectable={variant === 'chat'}
          >
            {line
              .split('')
              .map(ch => (ch === 'G' ? '🟩' : ch === 'Y' ? '🟨' : '⬛'))
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
        {didSubmit && submissionText ? renderWordleGrid(submissionText) : null}
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardScreen: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardChat: {
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
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
    color: '#1a1a1a',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  wordleGrid: {
    marginTop: 0,
    alignItems: 'center',
  },
  wordleRow: {
    fontSize: 20,
    marginBottom: 1,
    letterSpacing: 1,
  },
});
