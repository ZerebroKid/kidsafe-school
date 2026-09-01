/**
 * AIDoubtModal — Interactive AI Doubt Assistant Modal.
 *
 * Design: Phase 4 · Screens 07 & 08 — AI DOUBT (empty state & conversation)
 */

import React, {useState} from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, {Path, Circle, Rect} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import {brand, fonts, neutral, radius, spacing} from '../../../theme';

interface AIDoubtModalProps {
  visible: boolean;
  onClose: () => void;
  topicTitle?: string;
  sectionTitle?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  formula?: string;
  hasImage?: boolean;
}

export function AIDoubtModal({
  visible,
  onClose,
  topicTitle = 'Word Problems on Linear Equations',
  sectionTitle = 'Section 1 · Explanation',
}: AIDoubtModalProps) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const SUGGESTED_PROMPTS = [
    "Explain today's topic like I'm 10",
    "Give me one more solved example",
    "Why did we take x as the smallest number?",
  ];

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Simulate AI response after 1 second
    setTimeout(() => {
      setIsTyping(false);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'You can take any of the three. Choosing the smallest keeps the other two as x+1 and x+2 — only additions, nothing negative to track.',
        formula: 'x + (x+1) + (x+2) = 3x + 3',
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.safeTop}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 6l12 12M18 6L6 18" />
              </Svg>
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Ask AI</Text>
              <Text style={styles.headerSub}>{sectionTitle}</Text>
            </View>
          </View>
        </SafeAreaView>

        {/* Content Area */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}>

          {messages.length === 0 ? (
            /* ---------------- EMPTY STATE ---------------- */
            <View style={styles.emptyStateContainer}>
              <View style={styles.glowingAiBadge}>
                <Svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 5a4 4 0 0 0-4 4 3 3 0 0 0 0 6 3.5 3.5 0 0 0 4 3.4z" />
                  <Path d="M12 5a4 4 0 0 1 4 4 3 3 0 0 1 0 6 3.5 3.5 0 0 1-4 3.4z" />
                </Svg>
              </View>

              <Text style={styles.emptyTitle}>Stuck anywhere? Ask.</Text>
              <Text style={styles.emptySub}>
                Any doubt, from the middle of any lecture, as many times as you want.
              </Text>

              <View style={styles.promptsSection}>
                <Text style={styles.promptsOverline}>TRY ONE OF THESE</Text>
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.promptCard}
                    onPress={() => handleSend(prompt)}>
                    <Text style={styles.promptText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            /* ---------------- CONVERSATION STATE ---------------- */
            <View style={styles.chatCol}>
              <Text style={styles.chatDateDivider}>TODAY</Text>

              {messages.map(msg => {
                if (msg.sender === 'user') {
                  return (
                    <View key={msg.id} style={styles.userBubble}>
                      <Text style={styles.userMsgText}>{msg.text}</Text>
                    </View>
                  );
                } else {
                  return (
                    <View key={msg.id} style={styles.aiMessageRow}>
                      <View style={styles.aiAvatar}>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M12 5a4 4 0 0 0-4 4 3 3 0 0 0 0 6 3.5 3.5 0 0 0 4 3.4z" />
                          <Path d="M12 5a4 4 0 0 1 4 4 3 3 0 0 1 0 6 3.5 3.5 0 0 1-4 3.4z" />
                        </Svg>
                      </View>
                      <View style={styles.aiMsgCol}>
                        <View style={styles.aiBubble}>
                          <Text style={styles.aiMsgText}>{msg.text}</Text>
                        </View>
                        {msg.formula ? (
                          <View style={styles.formulaBox}>
                            <Text style={styles.formulaText}>{msg.formula}</Text>
                          </View>
                        ) : null}

                        <View style={styles.followupChipsRow}>
                          <Pressable style={styles.followupChip} onPress={() => handleSend('Show a simpler way')}>
                            <Text style={styles.followupChipText}>Show a simpler way</Text>
                          </Pressable>
                          <Pressable style={styles.followupChip} onPress={() => handleSend("Explain like I'm 10")}>
                            <Text style={styles.followupChipText}>Explain like I'm 10</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                }
              })}

              {isTyping ? (
                <View style={styles.typingRow}>
                  <View style={styles.aiAvatarSmall} />
                  <View style={styles.typingBubble}>
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
          <View style={styles.contextPill}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={brand.violet400} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 4h12v17l-6-4.6L6 21z" />
            </Svg>
            <Text style={styles.contextPillText} numberOfLines={1}>
              About: {topicTitle}
            </Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask anything…"
              placeholderTextColor={neutral.ink500}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSend()}
            />
            <Pressable style={styles.iconActionBtn} hitSlop={8}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={neutral.ink300} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 8.5A2 2 0 0 1 5 6.5h2L8.5 4h7L17 6.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <Circle cx={12} cy={13} r={3.4} />
              </Svg>
            </Pressable>
            <Pressable style={styles.iconActionBtn} hitSlop={8}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={neutral.ink300} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={9} y={3} width={6} height={11} rx={3} />
                <Path d="M5 12a7 7 0 0 0 14 0M12 19v3" />
              </Svg>
            </Pressable>
            <Pressable style={styles.sendBtn} onPress={() => handleSend()}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 3L3 10.5l7 3 3 7z" />
                <Path d="M21 3l-11 11" />
              </Svg>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: neutral.ink900,
  },
  safeTop: {
    backgroundColor: neutral.ink900,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.pagePad,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: neutral.darkSurface2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 17,
    color: neutral.surface,
  },
  headerSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: brand.violet400,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing.pagePad,
    paddingVertical: spacing.md,
    paddingBottom: 100,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  glowingAiBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: brand.violet600,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 22,
    lineHeight: 28,
    color: neutral.surface,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: neutral.ink300,
    textAlign: 'center',
    maxWidth: 280,
  },
  promptsSection: {
    width: '100%',
    gap: 10,
    marginTop: spacing.md,
  },
  promptsOverline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: neutral.ink500,
    marginBottom: 4,
  },
  promptCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1E1E3C',
  },
  promptText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 19,
    color: neutral.line200,
  },
  chatCol: {
    gap: spacing.md,
  },
  chatDateDivider: {
    alignSelf: 'center',
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: neutral.ink500,
    marginVertical: spacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    backgroundColor: brand.violet600,
  },
  userMsgText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: neutral.surface,
  },
  aiMessageRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: brand.violet600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: neutral.darkSurface2,
  },
  aiMsgCol: {
    flex: 1,
    gap: 8,
    maxWidth: '84%',
  },
  aiBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    backgroundColor: '#1E1E3C',
  },
  aiMsgText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: neutral.line200,
  },
  formulaBox: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: neutral.darkSurface2,
  },
  formulaText: {
    fontFamily: fonts.mono,
    fontSize: 15,
    lineHeight: 22,
    color: '#B9A1FF',
  },
  followupChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  followupChip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: '#1E1E3C',
    borderWidth: 1,
    borderColor: neutral.darkSurface2,
    justifyContent: 'center',
  },
  followupChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: '#B9A1FF',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typingBubble: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    backgroundColor: '#1E1E3C',
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: brand.violet400,
  },
  inputSafeArea: {
    backgroundColor: neutral.ink900,
    paddingHorizontal: spacing.pagePad,
    paddingBottom: spacing.md,
    gap: 10,
  },
  contextPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: '#1E1E3C',
  },
  contextPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: brand.violet400,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#1E1E3C',
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: neutral.surface,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: brand.violet600,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
