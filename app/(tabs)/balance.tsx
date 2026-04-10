import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

type Mood = 'happy' | 'okay' | 'tired';

const MOOD_META: Record<Mood, { emoji: string; color: string; label: string }> = {
  happy: { emoji: '😊', color: '#6C63FF', label: 'Happy' },
  okay:  { emoji: '😐', color: '#F5A623', label: 'Okay'  },
  tired: { emoji: '😴', color: '#43BCA8', label: 'Tired' },
};

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

interface DayData {
  date: string;
  focusMins: number;
  restMins: number;
  restTasks: number;
  mood: Mood | null;
}

export default function BalanceScreen() {
  const [days, setDays] = useState<DayData[]>([]);
  const [moodModal, setMoodModal] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const todayData = days.find((d) => d.date === today);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const dates = getLast7Days();
    const results: DayData[] = await Promise.all(
      dates.map(async (date) => {
        const focusRaw    = await AsyncStorage.getItem(`focus_${date}`);
        const restTimeRaw = await AsyncStorage.getItem(`rest_time_${date}`);
        const restRaw     = await AsyncStorage.getItem(`rest_${date}`);
        const moodRaw     = await AsyncStorage.getItem(`mood_${date}`);
        return {
          date,
          focusMins: focusRaw    ? Math.floor(parseInt(focusRaw,    10) / 60) : 0,
          restMins:  restTimeRaw ? Math.floor(parseInt(restTimeRaw, 10) / 60) : 0,
          restTasks: restRaw     ? parseInt(restRaw, 10) : 0,
          mood: (moodRaw as Mood) ?? null,
        };
      })
    );
    setDays(results);
  }

  async function saveMood(mood: Mood) {
    await AsyncStorage.setItem(`mood_${today}`, mood);
    setMoodModal(false);
    loadData();
  }

  const totalFocusMins = days.reduce((s, d) => s + d.focusMins, 0);
  const totalRestMins  = days.reduce((s, d) => s + d.restMins,  0);
  const totalRestTasks = days.reduce((s, d) => s + d.restTasks, 0);
  const maxBar = Math.max(...days.map((d) => Math.max(d.focusMins, d.restMins)), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Today's mood check-in */}
      <View style={styles.moodCard}>
        <View style={styles.moodLeft}>
          <Text style={styles.moodTitle}>How are you today?</Text>
          <Text style={styles.moodSub}>Quick daily check-in</Text>
        </View>
        <Pressable style={styles.moodBtn} onPress={() => setMoodModal(true)}>
          {todayData?.mood ? (
            <Text style={styles.moodCurrent}>{MOOD_META[todayData.mood].emoji}</Text>
          ) : (
            <Text style={styles.moodPrompt}>Tap a face</Text>
          )}
        </Pressable>
      </View>

      {/* Weekly totals */}
      <View style={styles.totalsRow}>
        <View style={[styles.totalCard, { borderColor: '#6C63FF33' }]}>
          <Text style={styles.totalEmoji}>🎯</Text>
          <Text style={[styles.totalValue, { color: '#6C63FF' }]}>{totalFocusMins}m</Text>
          <Text style={styles.totalLabel}>Focus this week</Text>
        </View>
        <View style={[styles.totalCard, { borderColor: '#43BCA833' }]}>
          <Text style={styles.totalEmoji}>☕</Text>
          <Text style={[styles.totalValue, { color: '#43BCA8' }]}>{totalRestMins}m</Text>
          <Text style={styles.totalLabel}>Rest this week</Text>
        </View>
      </View>

      {/* Bar chart */}
      <Text style={styles.sectionTitle}>Focus vs Rest — last 7 days</Text>
      <View style={styles.chart}>
        {days.map((day) => {
          const focusHeight = Math.max((day.focusMins / maxBar) * 120, day.focusMins > 0 ? 4 : 0);
          const restHeight  = Math.max((day.restMins  / maxBar) * 120, day.restMins  > 0 ? 4 : 0);
          const isToday = day.date === today;
          return (
            <View key={day.date} style={styles.barCol}>
              <Text style={styles.barValue}>
                {day.focusMins > 0 ? `${day.focusMins}` : ''}
              </Text>
              <View style={styles.barTrack}>
                <View style={styles.barPair}>
                  <View style={[styles.bar, { height: focusHeight, backgroundColor: isToday ? '#6C63FF' : '#6C63FF55' }]} />
                  <View style={[styles.bar, { height: restHeight,  backgroundColor: isToday ? '#43BCA8' : '#43BCA855' }]} />
                </View>
              </View>
              <Text style={[styles.barLabel, isToday && { color: '#6C63FF' }]}>
                {dayLabel(day.date)}
              </Text>
              {day.mood && (
                <Text style={styles.barMood}>{MOOD_META[day.mood].emoji}</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Mood history */}
      <Text style={styles.sectionTitle}>Mood this week</Text>
      <View style={styles.moodRow}>
        {days.map((day) => (
          <View key={day.date} style={styles.moodHistoryCol}>
            <Text style={styles.moodHistoryEmoji}>
              {day.mood ? MOOD_META[day.mood].emoji : '·'}
            </Text>
            <Text style={[styles.moodHistoryDay, day.date === today && { color: '#6C63FF' }]}>
              {dayLabel(day.date)}
            </Text>
          </View>
        ))}
      </View>

      {/* Balance tip */}
      <BalanceTip focusMins={totalFocusMins} restTasks={totalRestTasks} />

      {/* Mood picker modal */}
      <Modal
        visible={moodModal}
        transparent
        animationType="fade"
        onRequestClose={() => setMoodModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setMoodModal(false)} />
        <View style={styles.moodSheet}>
          <Text style={styles.moodSheetTitle}>How are you feeling?</Text>
          <View style={styles.moodOptions}>
            {(Object.keys(MOOD_META) as Mood[]).map((m) => (
              <Pressable key={m} style={styles.moodOption} onPress={() => saveMood(m)}>
                <Text style={styles.moodOptionEmoji}>{MOOD_META[m].emoji}</Text>
                <Text style={styles.moodOptionLabel}>{MOOD_META[m].label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function BalanceTip({ focusMins, restTasks }: { focusMins: number; restTasks: number }) {
  let tip = '';
  if (focusMins === 0 && restTasks === 0) {
    tip = 'Start your first focus session or rest quest today!';
  } else if (focusMins > 0 && restTasks === 0) {
    tip = "Great focus this week! Don't forget to add some rest quests too.";
  } else if (focusMins === 0 && restTasks > 0) {
    tip = "You're resting well — try a short focus session to balance it out.";
  } else {
    const ratio = focusMins / (restTasks * 30 + 1);
    if (ratio > 3) tip = 'Heavy focus week — schedule a proper rest quest tomorrow.';
    else if (ratio < 0.5) tip = "Lots of rest logged — great! Pair it with a focus block.";
    else tip = 'Nice balance this week. Keep it up!';
  }
  return (
    <View style={styles.tipCard}>
      <Text style={styles.tipEmoji}>💡</Text>
      <Text style={styles.tipText}>{tip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  moodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  moodLeft: { flex: 1 },
  moodTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  moodSub: { color: '#9E9E9E', fontSize: 12, marginTop: 2 },
  moodBtn: {
    backgroundColor: '#2A2A4A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  moodCurrent: { fontSize: 28 },
  moodPrompt: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },
  totalsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  totalCard: {
    flex: 1,
    backgroundColor: '#16213E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  totalEmoji: { fontSize: 24, marginBottom: 6 },
  totalValue: { fontSize: 28, fontWeight: '800' },
  totalLabel: { color: '#9E9E9E', fontSize: 11, marginTop: 2, textAlign: 'center' },
  sectionTitle: {
    color: '#9E9E9E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#16213E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barValue: {
    color: '#9E9E9E',
    fontSize: 9,
    height: 14,
  },
  barTrack: {
    width: '100%',
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    width: '70%',
    borderRadius: 4,
  },
  barLabel: {
    color: '#9E9E9E',
    fontSize: 11,
    fontWeight: '600',
  },
  barMood: {
    fontSize: 10,
  },
  moodRow: {
    flexDirection: 'row',
    backgroundColor: '#16213E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  moodHistoryCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  moodHistoryEmoji: { fontSize: 20 },
  moodHistoryDay: { color: '#9E9E9E', fontSize: 11, fontWeight: '600' },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#16213E',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  tipEmoji: { fontSize: 18 },
  tipText: { color: '#ccc', fontSize: 14, flex: 1, lineHeight: 20 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  moodSheet: {
    backgroundColor: '#16213E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  moodSheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 24,
  },
  moodOptions: {
    flexDirection: 'row',
    gap: 20,
  },
  moodOption: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2A2A4A',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  moodOptionEmoji: { fontSize: 36 },
  moodOptionLabel: { color: '#ccc', fontSize: 13, fontWeight: '600' },
});
