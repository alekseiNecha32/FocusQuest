import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const PLANT_STAGES = ['🌱', '🌿', '🪴', '🌳', '🌲'];
const MIN_MINUTES = 1;
const MAX_MINUTES = 120;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

export default function TimerScreen() {
  const [mode, setMode] = useState<'focus' | 'rest'>('focus');
  const [running, setRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  // Custom durations (in minutes)
  const [focusMins, setFocusMins] = useState(25);
  const [restMins, setRestMins] = useState(5);
  // Draft values inside the modal before Apply
  const [draftFocus, setDraftFocus] = useState(25);
  const [draftRest, setDraftRest] = useState(5);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const totalDuration = (mode === 'focus' ? focusMins : restMins) * 60;
  const [timeLeft, setTimeLeft] = useState(totalDuration);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedElapsed = useRef(0);
  const plantAnim = useRef(new Animated.Value(0.75)).current;

  const progress = 1 - timeLeft / totalDuration;
  // Plant stages through the 5 emojis as the session fills (🌱 → 🌲)
  const plantStage = Math.min(Math.floor(progress * PLANT_STAGES.length), PLANT_STAGES.length - 1);
  const accentColor = mode === 'focus' ? '#6C63FF' : '#43BCA8';

  useEffect(() => {
    AsyncStorage.getItem('sessions').then((v) => { if (v) setSessionsCompleted(parseInt(v, 10)); });
    AsyncStorage.getItem('focusMins').then((v) => { if (v) { const n = parseInt(v, 10); setFocusMins(n); setDraftFocus(n); } });
    AsyncStorage.getItem('restMins').then((v)  => { if (v) { const n = parseInt(v, 10); setRestMins(n);  setDraftRest(n);  } });
  }, []);

  // Sync timeLeft when durations change (only if not running)
  useEffect(() => {
    if (!running) setTimeLeft((mode === 'focus' ? focusMins : restMins) * 60);
  }, [focusMins, restMins, mode]);

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // Plant grows as focus session progresses
  useEffect(() => {
    if (mode !== 'focus') return;
    Animated.timing(plantAnim, {
      toValue: 0.75 + progress * 0.25,
      duration: 800,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [timeLeft]);

  // --- Storage helpers ---

  async function flushElapsed(currentTimeLeft: number) {
    const elapsed = totalDuration - currentTimeLeft;
    const delta = elapsed - lastSavedElapsed.current;
    if (delta <= 0) return;
    lastSavedElapsed.current = elapsed;
    const today = new Date().toISOString().split('T')[0];
    const key = mode === 'focus' ? `focus_${today}` : `rest_time_${today}`;
    const existing = await AsyncStorage.getItem(key);
    const prevSecs = existing ? parseInt(existing, 10) : 0;
    await AsyncStorage.setItem(key, (prevSecs + delta).toString());
  }

  async function handleSessionComplete() {
    await flushElapsed(0);
    lastSavedElapsed.current = 0;
    setRunning(false);
    const next = sessionsCompleted + 1;
    setSessionsCompleted(next);
    await AsyncStorage.setItem('sessions', next.toString());
    Animated.sequence([
      Animated.timing(plantAnim, { toValue: 1.4, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(plantAnim, { toValue: 1.0, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.quad)  }),
    ]).start();
  }

  async function handlePause(currentTimeLeft: number) {
    setRunning(false);
    await flushElapsed(currentTimeLeft);
  }

  async function reset() {
    setRunning(false);
    await flushElapsed(timeLeft);
    lastSavedElapsed.current = 0;
    setTimeLeft((mode === 'focus' ? focusMins : restMins) * 60);
    Animated.timing(plantAnim, { toValue: 0.75, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
  }

  function switchMode(next: 'focus' | 'rest') {
    flushElapsed(timeLeft);
    lastSavedElapsed.current = 0;
    setMode(next);
    setRunning(false);
    setTimeLeft((next === 'focus' ? focusMins : restMins) * 60);
    Animated.timing(plantAnim, { toValue: 0.75, duration: 300, useNativeDriver: true }).start();
  }

  function handleStartPause() {
    if (running) handlePause(timeLeft);
    else setRunning(true);
  }

  function openSettings() {
    setDraftFocus(focusMins);
    setDraftRest(restMins);
    setSettingsOpen(true);
  }

  async function applySettings() {
    setFocusMins(draftFocus);
    setRestMins(draftRest);
    await AsyncStorage.setItem('focusMins', draftFocus.toString());
    await AsyncStorage.setItem('restMins',  draftRest.toString());
    setSettingsOpen(false);
  }

  return (
    <View style={styles.container}>
      {/* Mode pills */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === 'focus' && { backgroundColor: '#6C63FF' }]}
          onPress={() => switchMode('focus')}
        >
          <Text style={[styles.modeBtnText, mode === 'focus' && { color: '#fff' }]}>Focus</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'rest' && { backgroundColor: '#43BCA8' }]}
          onPress={() => switchMode('rest')}
        >
          <Text style={[styles.modeBtnText, mode === 'rest' && { color: '#fff' }]}>Rest</Text>
        </Pressable>
      </View>

      {/* Timer ring */}
      <View style={styles.ringWrapper}>
        <View style={[styles.ringTrack, { borderColor: '#2A2A4A' }]} />
        <View style={[styles.ringProgress, { borderColor: accentColor, transform: [{ rotate: `${-90 + progress * 360}deg` }] }]} />
        <View style={styles.ringInner}>
          <Text style={[styles.timerText, { color: accentColor }]}>{formatTime(timeLeft)}</Text>
          <Text style={styles.modeLabel}>{mode === 'focus' ? '🎯 Focus' : '☕ Rest'}</Text>
        </View>
      </View>

      {/* Plant */}
      <Animated.Text style={[styles.plant, { transform: [{ scale: plantAnim }] }]}>
        {PLANT_STAGES[plantStage]}
      </Animated.Text>
      <Text style={styles.sessionsText}>{sessionsCompleted} sessions completed</Text>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable style={styles.iconBtn} onPress={reset}>
          <Text style={styles.iconBtnText}>↺</Text>
        </Pressable>

        <Pressable style={[styles.startBtn, { backgroundColor: accentColor }]} onPress={handleStartPause}>
          <Text style={styles.startBtnText}>{running ? 'Pause' : 'Start'}</Text>
        </Pressable>

        <Pressable
          style={[styles.iconBtn, running && { opacity: 0.3 }]}
          onPress={openSettings}
          disabled={running}
        >
          <FontAwesome name="sliders" size={20} color="#9E9E9E" />
        </Pressable>
      </View>

      {/* Settings modal */}
      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setSettingsOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Timer settings</Text>

          <DurationRow
            label="🎯  Focus"
            value={draftFocus}
            color="#6C63FF"
            onChange={(v) => setDraftFocus(clamp(v, MIN_MINUTES, MAX_MINUTES))}
          />
          <DurationRow
            label="☕  Rest"
            value={draftRest}
            color="#43BCA8"
            onChange={(v) => setDraftRest(clamp(v, MIN_MINUTES, MAX_MINUTES))}
          />

          <Pressable
            style={[styles.applyBtn, { backgroundColor: mode === 'focus' ? '#6C63FF' : '#43BCA8' }]}
            onPress={applySettings}
          >
            <Text style={styles.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function DurationRow({
  label, value, color, onChange,
}: {
  label: string; value: number; color: string; onChange: (v: number) => void;
}) {
  // Local text state so user can clear and retype freely
  const [text, setText] = React.useState(value.toString());

  // Keep text in sync when +/- buttons change the value externally
  React.useEffect(() => { setText(value.toString()); }, [value]);

  function handleChangeText(raw: string) {
    setText(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) onChange(parsed);
  }

  function handleBlur() {
    // On blur clamp and normalise display
    const parsed = parseInt(text, 10);
    const clamped = clamp(isNaN(parsed) ? value : parsed, MIN_MINUTES, MAX_MINUTES);
    onChange(clamped);
    setText(clamped.toString());
  }

  return (
    <View style={dStyles.row}>
      <Text style={dStyles.label}>{label}</Text>
      <View style={dStyles.controls}>
        <Pressable style={dStyles.btn} onPress={() => onChange(value - 5)}>
          <Text style={dStyles.btnText}>−5</Text>
        </Pressable>
        <Pressable style={dStyles.btn} onPress={() => onChange(value - 1)}>
          <Text style={dStyles.btnText}>−1</Text>
        </Pressable>
        <View style={[dStyles.valueBox, { borderColor: color }]}>
          <TextInput
            style={[dStyles.value, { color }]}
            value={text}
            onChangeText={handleChangeText}
            onBlur={handleBlur}
            keyboardType="number-pad"
            maxLength={3}
            selectTextOnFocus
          />
          <Text style={dStyles.unit}>min</Text>
        </View>
        <Pressable style={dStyles.btn} onPress={() => onChange(value + 1)}>
          <Text style={dStyles.btnText}>+1</Text>
        </Pressable>
        <Pressable style={dStyles.btn} onPress={() => onChange(value + 5)}>
          <Text style={dStyles.btnText}>+5</Text>
        </Pressable>
      </View>
    </View>
  );
}

const dStyles = StyleSheet.create({
  row: { marginBottom: 20 },
  label: { color: '#ccc', fontSize: 15, fontWeight: '600', marginBottom: 10 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: {
    backgroundColor: '#2A2A4A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  btnText: { color: '#9E9E9E', fontSize: 13, fontWeight: '700' },
  valueBox: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    width: '100%',
    textAlign: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    outlineWidth: 0,
    outlineStyle: 'none',
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  } as any,
  unit: { color: '#9E9E9E', fontSize: 11 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    paddingTop: 36,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#2A2A4A',
    borderRadius: 24,
    padding: 4,
    marginBottom: 36,
  },
  modeBtn: { paddingHorizontal: 32, paddingVertical: 9, borderRadius: 20 },
  modeBtnText: { color: '#9E9E9E', fontWeight: '600', fontSize: 15 },
  ringWrapper: {
    width: 260, height: 260,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  ringTrack: {
    position: 'absolute',
    width: 220, height: 220,
    borderRadius: 110, borderWidth: 10,
  },
  ringProgress: {
    position: 'absolute',
    width: 220, height: 220,
    borderRadius: 110, borderWidth: 10,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  ringInner: { alignItems: 'center' },
  timerText: { fontSize: 52, fontWeight: '700', letterSpacing: 2 },
  modeLabel: { color: '#9E9E9E', fontSize: 14, marginTop: 6 },
  plant: { fontSize: 60, marginBottom: 6 },
  sessionsText: { color: '#9E9E9E', fontSize: 13, marginBottom: 36 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  startBtn: { paddingHorizontal: 52, paddingVertical: 15, borderRadius: 32 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  iconBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#2A2A4A',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { color: '#9E9E9E', fontSize: 22 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: '#16213E',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  sheetHandle: {
    width: 40, height: 4,
    backgroundColor: '#3A3A5A', borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 24 },
  applyBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
