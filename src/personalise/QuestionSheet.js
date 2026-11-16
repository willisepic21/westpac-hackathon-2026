// "Personalise your home" pop-up: one question at a time, answers as tappable bubbles.
//   - "Next →" bubble appears once the question is answered
//   - After the last question: "Back to start" or "Finalise"
// Finalise calls onFinalise(answers); HomeScreen saves them and shows the matching template.

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { QUESTIONS, isAnswered } from './questions';
import { buildHome } from './buildHome';

const RED = '#D5002B';
const NAVY = '#1F1C4F';

function Bubble({ label, icon, swatches, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.bubble, selected && styles.bubbleSelected, pressed && { opacity: 0.8 }]}
    >
      {swatches ? (
        <View style={styles.swatches}>
          {swatches.map((c, i) => (
            <View key={i} style={[styles.swatch, { backgroundColor: c, marginLeft: i ? -6 : 0 }]} />
          ))}
        </View>
      ) : icon ? (
        <Ionicons name={icon} size={18} color={selected ? '#fff' : NAVY} />
      ) : null}
      <Text style={[styles.bubbleText, selected && styles.bubbleTextSelected]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
    </Pressable>
  );
}

function ActionBubble({ label, icon, onPress, primary, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionSecondary,
        disabled && { opacity: 0.35 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon && !primary ? <Ionicons name={icon} size={16} color={NAVY} /> : null}
      <Text style={[styles.actionText, primary && { color: '#fff' }]}>{label}</Text>
      {icon && primary ? <Ionicons name={icon} size={16} color="#fff" /> : null}
    </Pressable>
  );
}

export default function QuestionSheet({ visible, initialAnswers, onClose, onFinalise, onReset }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers ?? {});

  // Start from the first question (with any saved answers) each time it opens
  useEffect(() => {
    if (visible) {
      setStep(0);
      setAnswers(initialAnswers ?? {});
    }
  }, [visible, initialAnswers]);

  const question = QUESTIONS[step];
  const answer = answers[question.id];
  const answered = isAnswered(question, answer);
  const isLast = step === QUESTIONS.length - 1;

  const choose = (value) => {
    setAnswers((prev) => {
      if (!question.multi) return { ...prev, [question.id]: value };
      const current = prev[question.id] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [question.id]: next };
    });
  };

  const isSelected = (value) => (question.multi ? (answer ?? []).includes(value) : answer === value);

  const allAnswered = QUESTIONS.every((q) => isAnswered(q, answers[q.id]));
  const preview = isLast && allAnswered ? buildHome(answers) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.topRow}>
            <Text style={styles.kicker}>Personalise your home</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={NAVY} />
            </Pressable>
          </View>

          {/* Progress */}
          <View style={styles.progress}>
            {QUESTIONS.map((q, i) => (
              <View key={q.id} style={[styles.dot, i <= step && { backgroundColor: RED }]} />
            ))}
          </View>
          <Text style={styles.count}>
            Question {step + 1} of {QUESTIONS.length}
          </Text>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={styles.title}>{question.title}</Text>
            {question.hint ? <Text style={styles.hint}>{question.hint}</Text> : null}

            <View style={styles.bubbles}>
              {question.options.map((o) => (
                <Bubble
                  key={o.value}
                  label={o.label}
                  icon={o.icon}
                  swatches={o.swatches}
                  selected={isSelected(o.value)}
                  onPress={() => choose(o.value)}
                />
              ))}
            </View>

            {preview ? (
              <View style={[styles.preview, { backgroundColor: preview.theme.bg }]}>
                <View style={[styles.previewSwatch, { backgroundColor: preview.theme.hero }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewLabel, { color: preview.theme.muted }]}>Your home will use</Text>
                  <Text style={[styles.previewTitle, { color: preview.theme.text }]}>
                    {preview.template.name} · “{preview.template.title}”
                  </Text>
                  <Text style={[styles.previewLabel, { color: preview.theme.muted }]}>{preview.tags}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer bubbles */}
          <View style={styles.footer}>
            {isLast && answered ? (
              <>
                <ActionBubble label="Back to start" icon="refresh" onPress={() => setStep(0)} />
                <ActionBubble
                  label="Finalise"
                  icon="checkmark"
                  primary
                  disabled={!allAnswered}
                  onPress={() => onFinalise(answers)}
                />
              </>
            ) : (
              <>
                {step > 0 ? (
                  <ActionBubble label="Back" icon="arrow-back" onPress={() => setStep(step - 1)} />
                ) : onReset ? (
                  <ActionBubble label="Use standard home" icon="home-outline" onPress={onReset} />
                ) : (
                  <View />
                )}
                <ActionBubble
                  label="Next"
                  icon="arrow-forward"
                  primary
                  disabled={!answered}
                  onPress={() => setStep(step + 1)}
                />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 12, 40, 0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: RED, fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  progress: { flexDirection: 'row', gap: 6, marginTop: 14 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E3EE' },
  count: { color: '#6B6A80', fontSize: 12, marginTop: 8 },
  title: { color: NAVY, fontSize: 22, fontWeight: '700', marginTop: 10 },
  hint: { color: '#6B6A80', fontSize: 14, marginTop: 6 },
  bubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D9D6E6',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  bubbleSelected: { backgroundColor: RED, borderColor: RED },
  bubbleText: { color: NAVY, fontSize: 15, fontWeight: '600' },
  bubbleTextSelected: { color: '#fff' },
  swatches: { flexDirection: 'row' },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#fff' },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E5E3EE',
  },
  previewSwatch: { width: 36, height: 36, borderRadius: 10 },
  previewLabel: { fontSize: 12 },
  previewTitle: { fontSize: 15, fontWeight: '700', marginVertical: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 20 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  actionPrimary: { backgroundColor: RED },
  actionSecondary: { backgroundColor: '#F1F0F6' },
  actionText: { color: NAVY, fontSize: 15, fontWeight: '700' },
});
