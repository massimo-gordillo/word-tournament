import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Lock, Send } from 'lucide-react-native';
import { DailySubmissionCard } from '@/components/DailySubmissionCard';

/** Must match placeholder written for `tournament_chat.message` when `message_type` is `result`. */
const RESULT_MESSAGE_PLACEHOLDER = 'result';

export interface TournamentChatMessage {
  id: string;
  user_id: string;
  message: string;
  message_type: 'chat' | 'result';
  submission_date: string | null;
  created_at: string;
  display_name: string;
  daily_submission_id?: string | null;
  submission_text?: string | null;
  wordle_score?: number | null;
}

interface TournamentChatSectionProps {
  messages: TournamentChatMessage[];
  currentUserId: string | undefined;
  todayEst: string;
  resultsReadyForToday: boolean;
  canCompose: boolean;
  sending: boolean;
  onSend: (text: string) => Promise<void>;
}

function resultIsRevealed(
  submissionDate: string | null,
  todayEst: string,
  resultsReadyForToday: boolean,
): boolean {
  if (!submissionDate) return true;
  if (submissionDate < todayEst) return true;
  if (submissionDate === todayEst) return resultsReadyForToday;
  return false;
}

export function TournamentChatSection({
  messages,
  currentUserId,
  todayEst,
  resultsReadyForToday,
  canCompose,
  sending,
  onSend,
}: TournamentChatSectionProps) {
  const [draft, setDraft] = useState('');

  const handleSend = async () => {
    const t = draft.trim();
    if (!t || sending) return;
    setDraft('');
    await onSend(t);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tournament chat</Text>

      <View style={styles.feed}>
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet</Text>
        ) : (
          messages.map(msg => {
            if (msg.message_type === 'result') {
              const isSelf = msg.user_id === currentUserId;
              const revealed = resultIsRevealed(
                msg.submission_date,
                todayEst,
                resultsReadyForToday,
              );
              const lockIconColor = isSelf ? '#d1fae5' : '#6b7280';

              const hasSubmissionPayload =
                !!msg.submission_text &&
                msg.submission_text.length > 0 &&
                typeof msg.wordle_score === 'number';

              const hasLegacyRevealBody =
                !!msg.message &&
                msg.message !== RESULT_MESSAGE_PLACEHOLDER &&
                !hasSubmissionPayload;

              return (
                <View
                  key={msg.id}
                  style={[styles.chatRow, isSelf ? styles.chatRowSelf : styles.chatRowOther]}
                >
                  <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
                    {!revealed ? (
                      <View style={styles.resultLockedInner}>
                        <Lock size={16} color={lockIconColor} />
                        <Text
                          style={[
                            styles.resultLockedBubbleText,
                            isSelf && styles.resultLockedBubbleTextSelf,
                          ]}
                        >
                          {msg.display_name} has submitted their result
                        </Text>
                      </View>
                    ) : hasSubmissionPayload ? (
                      <DailySubmissionCard
                        variant="chat"
                        dateLabel={
                          msg.submission_date
                            ? msg.submission_date.slice(0, 10)
                            : undefined
                        }
                        playerName={msg.display_name}
                        didSubmit
                        score={msg.wordle_score ?? undefined}
                        submissionText={msg.submission_text ?? undefined}
                      />
                    ) : hasLegacyRevealBody ? (
                      <Text
                        style={[styles.resultLegacyText, isSelf && styles.bubbleTextSelf]}
                        selectable
                      >
                        {msg.message}
                      </Text>
                    ) : (
                      <Text
                        style={[styles.resultFallbackText, isSelf && styles.resultLockedBubbleTextSelf]}
                      >
                        Result unavailable
                      </Text>
                    )}
                  </View>
                </View>
              );
            }

            const isSelf = msg.user_id === currentUserId;
            return (
              <View
                key={msg.id}
                style={[styles.chatRow, isSelf ? styles.chatRowSelf : styles.chatRowOther]}
              >
                {!isSelf && (
                  <Text style={styles.peerName}>{msg.display_name}</Text>
                )}
                <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>
                    {msg.message}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {canCompose && (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={400}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (sending || !draft.trim()) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={sending || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  feed: {
    minHeight: 80,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    paddingVertical: 16,
  },
  chatRow: {
    marginBottom: 10,
    maxWidth: '85%',
  },
  chatRowSelf: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  chatRowOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  peerName: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '100%',
  },
  bubbleSelf: {
    backgroundColor: '#10b981',
  },
  bubbleOther: {
    backgroundColor: '#e5e7eb',
  },
  bubbleText: {
    fontSize: 16,
    color: '#1f2937',
  },
  bubbleTextSelf: {
    color: '#fff',
  },
  resultLockedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  resultLockedBubbleText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#4b5563',
    flexShrink: 1,
  },
  resultLockedBubbleTextSelf: {
    color: 'rgba(255,255,255,0.95)',
  },
  resultLegacyText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    lineHeight: 18,
    color: '#111827',
  },
  resultFallbackText: {
    fontSize: 14,
    color: '#4b5563',
    fontStyle: 'italic',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 16,
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    color: '#1a1a1a',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
