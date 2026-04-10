import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';

type QuestType = 'focus' | 'rest';

interface Quest {
  id: string;
  title: string;
  type: QuestType;
  done: boolean;
}

const STORAGE_KEY = 'quests';

const TYPE_META: Record<QuestType, { color: string; icon: string; label: string }> = {
  focus: { color: '#6C63FF', icon: '🎯', label: 'Focus' },
  rest:  { color: '#43BCA8', icon: '☕', label: 'Rest'  },
};

export default function QuestsScreen() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<QuestType>('focus');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadQuests();
  }, []);

  async function loadQuests() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) setQuests(JSON.parse(raw));
  }

  async function saveQuests(updated: Quest[]) {
    setQuests(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function addQuest() {
    const title = newTitle.trim();
    if (!title) return;
    const quest: Quest = {
      id: Date.now().toString(),
      title,
      type: newType,
      done: false,
    };
    await saveQuests([...quests, quest]);
    setNewTitle('');
    setNewType('focus');
    setModalVisible(false);
  }

  async function toggleQuest(id: string) {
    const updated = quests.map((q) =>
      q.id === id ? { ...q, done: !q.done } : q
    );
    // Log rest time when a rest quest is completed
    const toggled = updated.find((q) => q.id === id);
    if (toggled?.done && toggled.type === 'rest') {
      const today = new Date().toISOString().split('T')[0];
      const key = `rest_${today}`;
      const existing = await AsyncStorage.getItem(key);
      const count = (existing ? parseInt(existing, 10) : 0) + 1;
      await AsyncStorage.setItem(key, count.toString());
    }
    await saveQuests(updated);
  }

  async function deleteQuest(id: string) {
    await saveQuests(quests.filter((q) => q.id !== id));
  }

  const focusCount = quests.filter((q) => q.type === 'focus' && q.done).length;
  const restCount  = quests.filter((q) => q.type === 'rest'  && q.done).length;
  const total      = quests.length;
  const doneTotal  = quests.filter((q) => q.done).length;

  function renderQuest({ item }: { item: Quest }) {
    const meta = TYPE_META[item.type];
    return (
      <QuestRow
        quest={item}
        meta={meta}
        onToggle={() => toggleQuest(item.id)}
        onDelete={() => deleteQuest(item.id)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header summary */}
      <View style={styles.summary}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryEmoji}>🎯</Text>
          <Text style={styles.summaryText}>{focusCount} focus done</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryEmoji}>☕</Text>
          <Text style={styles.summaryText}>{restCount} rest done</Text>
        </View>
        {total > 0 && (
          <Text style={styles.summaryProgress}>{doneTotal}/{total}</Text>
        )}
      </View>

      {/* List */}
      {quests.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No quests yet</Text>
          <Text style={styles.emptyHint}>Mix focus tasks with rest activities</Text>
        </View>
      ) : (
        <FlatList
          data={quests}
          keyExtractor={(item) => item.id}
          renderItem={renderQuest}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <FontAwesome name="plus" size={22} color="#fff" />
      </Pressable>

      {/* Add Quest Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>New Quest</Text>

          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="e.g. Deep work 45 min, Watch a show…"
            placeholderTextColor="#555"
            value={newTitle}
            onChangeText={setNewTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={addQuest}
          />

          {/* Type toggle */}
          <View style={styles.typeRow}>
            {(['focus', 'rest'] as QuestType[]).map((t) => {
              const m = TYPE_META[t];
              const active = newType === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.typeBtn, active && { backgroundColor: m.color }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={styles.typeBtnEmoji}>{m.icon}</Text>
                  <Text style={[styles.typeBtnText, active && { color: '#fff' }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.addBtn, { backgroundColor: TYPE_META[newType].color }]}
            onPress={addQuest}
          >
            <Text style={styles.addBtnText}>Add Quest</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function QuestRow({
  quest,
  meta,
  onToggle,
  onDelete,
}: {
  quest: Quest;
  meta: { color: string; icon: string; label: string };
  onToggle: () => void;
  onDelete: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handleToggle() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    onToggle();
  }

  return (
    <Animated.View style={[styles.row, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable style={styles.rowCheck} onPress={handleToggle}>
        <View
          style={[
            styles.checkbox,
            quest.done && { backgroundColor: meta.color, borderColor: meta.color },
          ]}
        >
          {quest.done && <FontAwesome name="check" size={11} color="#fff" />}
        </View>
      </Pressable>

      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, quest.done && styles.rowTitleDone]}>
          {quest.title}
        </Text>
        <View style={[styles.typeBadge, { backgroundColor: meta.color + '22' }]}>
          <Text style={[styles.typeBadgeText, { color: meta.color }]}>
            {meta.icon} {meta.label}
          </Text>
        </View>
      </View>

      <Pressable style={styles.deleteBtn} onPress={onDelete}>
        <FontAwesome name="trash-o" size={16} color="#555" />
      </Pressable>
    </Animated.View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A4A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  summaryEmoji: { fontSize: 13 },
  summaryText: { color: '#ccc', fontSize: 12, fontWeight: '600' },
  summaryProgress: {
    marginLeft: 'auto',
    color: '#9E9E9E',
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyHint: { color: '#9E9E9E', fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#16213E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3A3A5A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#2A2A4A',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2A2A4A',
    borderRadius: 12,
    paddingVertical: 12,
  },
  typeBtnEmoji: { fontSize: 16 },
  typeBtnText: { color: '#9E9E9E', fontWeight: '600', fontSize: 15 },
  addBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  rowCheck: { padding: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3A3A5A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowTitleDone: { color: '#555', textDecorationLine: 'line-through' },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { padding: 6 },
});
