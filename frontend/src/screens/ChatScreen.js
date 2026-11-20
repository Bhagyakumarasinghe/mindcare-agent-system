import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  Keyboard,
  Image,
  Modal,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Send, 
  ChevronLeft, 
  AlertTriangle, 
  History, 
  SquarePen, 
  PlusCircle, 
  Trash2, 
  X, 
  Wind, 
  Clock, 
  Headphones, 
  Bookmark, 
  CheckCircle2, 
  Sparkles, 
  BookOpen 
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  sendChatMessage, 
  sendCBTChatMessage, 
  getUserProfile, 
  analyzeAndRecordJournal 
} from '../api/authService';
import { EmergencyModal } from '../components/CrisisModal';

const AGENT_AVATAR = require('../../assets/images/agent.jpg');

// Academic distress detector: identifies student distress related to exams, deadlines, burnout, grades
const isAcademicDistress = (text) => {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();

  const directPhrases = [
    'fail my', 'failing my', 'going to fail', 'might fail', 'will fail', 'flunk',
    'overwhelmed by deadline', 'overwhelmed by deadlines', 'overwhelmed with deadline',
    'overwhelmed by exam', 'overwhelmed by exams', 'overwhelmed by work', 'overwhelmed by coursework',
    'exam anxiety', 'deadline pressure', 'academic pressure', 'academic stress',
    'falling behind', 'behind on', 'cannot pass', "can't pass", 'cant pass',
    'test anxiety', 'study stress', 'finals stress', 'midterm stress', 'burnout from studying',
    'sleep and burnout', 'insomnia and study', 'cannot sleep exam'
  ];
  if (directPhrases.some((phrase) => lower.includes(phrase))) {
    return true;
  }

  const distressWords = [
    'fail', 'failing', 'anxious', 'anxiety', 'panic', 'panicking',
    'scared', 'dread', 'overwhelmed', 'stressed', 'stress', 'stressing',
    'hopeless', 'worried', 'worrying', 'struggling', 'freeze', 'freezing', 'burnout', 'exhausted'
  ];
  const academicWords = [
    'exam', 'exams', 'final', 'finals', 'midterm', 'midterms',
    'deadline', 'deadlines', 'assignment', 'assignments', 'coursework',
    'project', 'gpa', 'grade', 'grades', 'class', 'classes', 'test', 'tests', 'sleep', 'burnout'
  ];

  const hasDistress = distressWords.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower));
  const hasAcademic = academicWords.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower));

  return hasDistress && hasAcademic;
};

// Returns a clinical topic title for the CBT card badge
const getAcademicTopicLabel = (text) => {
  const lower = (text || '').toLowerCase();
  if (lower.includes('exam') || lower.includes('final') || lower.includes('midterm') || lower.includes('test')) {
    return 'Exam Anxiety';
  }
  if (lower.includes('deadline') || lower.includes('assignment') || lower.includes('coursework') || lower.includes('project')) {
    return 'Deadline Pressure';
  }
  if (lower.includes('sleep') || lower.includes('burnout') || lower.includes('tired') || lower.includes('exhausted')) {
    return 'Sleep & Burnout';
  }
  if (lower.includes('fail') || lower.includes('gpa') || lower.includes('grade') || lower.includes('doubt')) {
    return 'Self-Doubt & Fear';
  }
  return 'Academic Resilience';
};

// Strips generic conversational greetings like "Hey, it's totally normal to feel that way..."
const cleanCbtText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/^(Hey|Hello|Hi|It's totally normal to feel that way|It is normal to feel that way|It's completely normal|Don't worry|I understand how you feel|I hear you)[!.,\s–-]*/i, '')
    .trim();
};

// Infer relaxation tool shortcut based on text
const inferToolFromContext = (text) => {
  const lower = (text || '').toLowerCase();
  if (lower.includes('breath') || lower.includes('panic') || lower.includes('anxious') || lower.includes('anxiety') || lower.includes('racing') || lower.includes('tight')) {
    return 'breathing';
  }
  if (lower.includes('study') || lower.includes('exam') || lower.includes('deadline') || lower.includes('focus') || lower.includes('pomodoro') || lower.includes('assignment')) {
    return 'focus';
  }
  if (lower.includes('sleep') || lower.includes('burnout') || lower.includes('tired') || lower.includes('insomnia') || lower.includes('calm') || lower.includes('sanctuary')) {
    return 'meditation';
  }
  return null;
};

// Immediate High Distress & Self-Harm Detection Regex
const distressKeywords = /kill myself|end my life|suicide|hurt myself|want to die|self-harm|commit suicide|ending my life|cut myself|hang myself|take all my pills|overdose/i;

const DEFAULT_WELCOME_MSG = {
  id: '1',
  text: "Hello, I'm your MindCare Clinical Support Guide. How is your mind feeling today?",
  sender: 'guide',
  time: 'Clinical Guidance',
  agent_used: 'MindCare Support Guide'
};

export default function ChatScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [crisisData, setCrisisData] = useState(null);
  const [userId, setUserId] = useState('demo_user');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Multi-Session Chat History State
  const [currentSessionId, setCurrentSessionId] = useState(() => 'session_' + Date.now());
  const [sessions, setSessions] = useState([]);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [chatHistory, setChatHistory] = useState([DEFAULT_WELCOME_MSG]);

  const flatListRef = useRef();

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Fetch authenticated user ID
  useEffect(() => {
    getUserProfile().then(res => {
      if (res?.data?.id) setUserId(res.data.id);
    }).catch(() => {});
  }, []);

  // Load chat sessions from AsyncStorage on user change
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const storageKey = `@mindcare_chat_sessions_${userId}`;
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed);
            const active = parsed[0];
            setCurrentSessionId(active.id);
            if (Array.isArray(active.messages) && active.messages.length > 0) {
              setChatHistory(active.messages);
            }
            return;
          }
        }
        // Initialize default session
        const initialSessionId = 'session_' + Date.now();
        const initialSession = {
          id: initialSessionId,
          title: 'New Session',
          updatedAt: new Date().toISOString(),
          messages: [DEFAULT_WELCOME_MSG]
        };
        setSessions([initialSession]);
        setCurrentSessionId(initialSessionId);
        setChatHistory([DEFAULT_WELCOME_MSG]);
        await AsyncStorage.setItem(storageKey, JSON.stringify([initialSession]));
      } catch (e) {
        console.log('Error loading chat sessions:', e);
      }
    };

    loadSessions();
  }, [userId]);

  // Persist session messages whenever chatHistory updates & auto-title new sessions
  const persistSessionMessages = useCallback(async (newMessages) => {
    if (!newMessages || newMessages.length === 0) return;
    try {
      const storageKey = `@mindcare_chat_sessions_${userId}`;
      setSessions((prevSessions) => {
        let found = false;
        const updated = prevSessions.map((s) => {
          if (s.id === currentSessionId) {
            found = true;
            let title = s.title;
            // Auto-title New Session based on first user message / CBT chip snippet (first 28 characters)
            if (title === 'New Session' || title === 'Support Session' || !title) {
              const firstUser = newMessages.find((m) => m.sender === 'user');
              if (firstUser && firstUser.text) {
                const rawText = typeof firstUser.text === 'string' ? firstUser.text : JSON.stringify(firstUser.text);
                const cleaned = rawText.replace(/^Clinical Focus:\s*/i, '').trim();
                if (cleaned) {
                  title = cleaned.slice(0, 28) + (cleaned.length > 28 ? '...' : '');
                }
              }
            }
            return {
              ...s,
              title,
              updatedAt: new Date().toISOString(),
              messages: newMessages
            };
          }
          return s;
        });

        if (!found) {
          let title = 'New Session';
          const firstUser = newMessages.find((m) => m.sender === 'user');
          if (firstUser && firstUser.text) {
            const rawText = typeof firstUser.text === 'string' ? firstUser.text : JSON.stringify(firstUser.text);
            const cleaned = rawText.replace(/^Clinical Focus:\s*/i, '').trim();
            if (cleaned) {
              title = cleaned.slice(0, 28) + (cleaned.length > 28 ? '...' : '');
            }
          }
          updated.unshift({
            id: currentSessionId,
            title,
            updatedAt: new Date().toISOString(),
            messages: newMessages
          });
        }

        AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    } catch (err) {
      console.log('Error saving session:', err);
    }
  }, [userId, currentSessionId]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [chatHistory, loading]);

  // Start a new chat session
  const handleStartNewChat = () => {
    const newId = 'session_' + Date.now();
    const freshMessages = [
      {
        id: Date.now().toString(),
        text: "Hello, I'm your MindCare Clinical Support Guide. How is your mind feeling today?",
        sender: 'guide',
        time: 'Clinical Guidance',
        agent_used: 'MindCare Support Guide'
      }
    ];
    setCurrentSessionId(newId);
    setChatHistory(freshMessages);

    const newSession = {
      id: newId,
      title: 'New Session',
      updatedAt: new Date().toISOString(),
      messages: freshMessages
    };

    const storageKey = `@mindcare_chat_sessions_${userId}`;
    setSessions((prev) => {
      const updated = [newSession, ...prev];
      AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  // Switch to a past session
  const handleSelectSession = (s) => {
    if (!s) return;
    setCurrentSessionId(s.id);
    setChatHistory(s.messages || [DEFAULT_WELCOME_MSG]);
    setIsHistoryModalVisible(false);
  };

  // Delete a session
  const handleDeleteSession = (sessionIdToDelete) => {
    const storageKey = `@mindcare_chat_sessions_${userId}`;
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionIdToDelete);
      AsyncStorage.setItem(storageKey, JSON.stringify(filtered)).catch(() => {});
      if (sessionIdToDelete === currentSessionId) {
        if (filtered.length > 0) {
          setCurrentSessionId(filtered[0].id);
          setChatHistory(filtered[0].messages || [DEFAULT_WELCOME_MSG]);
        } else {
          handleStartNewChat();
        }
      }
      return filtered;
    });
  };

  // Navigate to relaxation tool
  const handleOpenTool = (tool) => {
    if (tool === 'breathing') {
      navigation.navigate('BreathingScreen');
    } else if (tool === 'focus') {
      navigation.navigate('FocusTimerScreen', { initialMinutes: 25 });
    } else if (tool === 'meditation') {
      navigation.navigate('GuidedMeditationScreen');
    }
  };

  const getToolLabel = (tool) => {
    if (tool === 'breathing') return 'Start 2-Min Calm Breathing';
    if (tool === 'focus') return 'Launch 25m Focus Session';
    if (tool === 'meditation') return 'Open Audio Sanctuary';
    return 'Open Mindful Sanctuary';
  };

  const renderToolIcon = (tool) => {
    if (tool === 'breathing') return <Wind size={13} color="#0D9488" style={{ marginRight: 6 }} />;
    if (tool === 'focus') return <Clock size={13} color="#0D9488" style={{ marginRight: 6 }} />;
    if (tool === 'meditation') return <Headphones size={13} color="#0D9488" style={{ marginRight: 6 }} />;
    return <Sparkles size={13} color="#0D9488" style={{ marginRight: 6 }} />;
  };

  // Save AI insight or CBT reframe directly into Reflective Journal
  const handleSaveToJournal = async (item) => {
    try {
      let textToSave = '';
      if (item.isCBT && item.cbtData) {
        textToSave = `[CBT Reframe - ${item.cbtData.topic}]\nThought: ${item.cbtData.thought_identification}\nReality Check: ${item.cbtData.reality_check}\nReframe: ${item.cbtData.cognitive_reframe}`;
      } else {
        textToSave = typeof item.text === 'string' ? item.text : JSON.stringify(item.text);
      }

      if (!textToSave.trim()) return;

      // 1. Call Backend Journal API
      try {
        await analyzeAndRecordJournal({
          user_id: userId,
          content: textToSave,
          emotion: 'Reflective'
        });
      } catch (apiErr) {
        console.log('Journal API record notice:', apiErr?.message || apiErr);
      }

      // 2. Also save to local storage for quick access
      const storageKey = `@mindcare_journal_entries_${userId}`;
      const existing = await AsyncStorage.getItem(storageKey);
      const parsed = existing ? JSON.parse(existing) : [];
      const newEntry = {
        id: `journal-${Date.now()}`,
        content: textToSave,
        emotion: 'Reflective',
        timestamp: new Date().toISOString()
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify([newEntry, ...parsed]));

      Alert.alert(
        'Saved to Journal 📖',
        'This reflection has been securely recorded to your Reflective Journal timeline.'
      );
    } catch (err) {
      console.error('Error saving to journal:', err);
      Alert.alert('Notice', 'Unable to record to journal at this moment.');
    }
  };

  const handleSendCBTMessage = async (messageText, contextChip = null) => {
    if (loading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newUserMessage = {
      id: Date.now().toString(),
      text: contextChip ? `Clinical Focus: ${contextChip}` : messageText,
      sender: 'user',
      time: userTime
    };

    const nextHistory = [...chatHistory, newUserMessage];
    setChatHistory(nextHistory);
    persistSessionMessages(nextHistory);
    setLoading(true);

    // Direct client-side distress keywords check
    if (distressKeywords.test(messageText)) {
      setShowEmergencyModal(true);
      setCrisisData({
        crisis_triggered: true,
        is_crisis: true,
        trigger_emergency: true,
        severity: 'CRITICAL',
        category: 'Immediate Risk / Self-Harm Prevention',
        message: 'We care deeply about your well-being. Immediate confidential clinical support is available right now.',
        helplines: [
          { name: 'National Mental Health Helpline', number: '1926' },
          { name: 'Sumithrayo Sri Lanka', number: '0112696666' }
        ]
      });
      const guideMessage = {
        id: (Date.now() + 1).toString(),
        text: 'We care deeply about your well-being. Immediate confidential clinical support is available right now.',
        sender: 'guide',
        time: userTime,
        isCrisis: true,
        agent_used: 'Crisis Intervention Agent'
      };
      const updatedWithCrisis = [...nextHistory, guideMessage];
      setChatHistory(updatedWithCrisis);
      persistSessionMessages(updatedWithCrisis);
    }

    try {
      const response = await sendCBTChatMessage(userId, messageText, contextChip || messageText);
      const data = response?.data;

      // Clinical Crisis Interception
      if (data?.crisis_triggered || data?.is_crisis || data?.trigger_emergency || data?.severity === 'CRITICAL') {
        setCrisisData(data);
        setShowEmergencyModal(true);
        const guideMessage = {
          id: (Date.now() + 1).toString(),
          text: data.reply || data.message || "We care deeply about your well-being. Immediate confidential clinical support is available right now.",
          sender: 'guide',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isCrisis: true,
          agent_used: 'Crisis Intervention Agent'
        };
        const updated = [...nextHistory, guideMessage];
        setChatHistory(updated);
        persistSessionMessages(updated);
        return;
      }

      const inferredTool = data?.suggested_tool || inferToolFromContext(messageText + ' ' + (data?.cognitive_reframe || ''));
      const guideMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'guide',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agent_used: data?.agent_used || 'CBT Clinical Agent',
        suggested_tool: inferredTool,
        isCBT: true,
        cbtData: {
          topic: contextChip || getAcademicTopicLabel(messageText),
          thought_identification: cleanCbtText(data?.thought_identification) || 'Automatic negative thinking and academic distortion detected.',
          reality_check: cleanCbtText(data?.reality_check) || 'What objective evidence challenges this worst-case scenario?',
          cognitive_reframe: cleanCbtText(data?.cognitive_reframe) || cleanCbtText(data?.reply) || 'Breaking preparation into sequential focus blocks restores executive control.'
        }
      };
      const updated = [...nextHistory, guideMessage];
      setChatHistory(updated);
      persistSessionMessages(updated);
    } catch (error) {
      console.error('CBT Generation Error:', error);
      const errMessage = {
        id: 'error-' + Date.now(),
        text: 'Unable to process CBT reframing at this moment. Please try sending a message directly.',
        sender: 'guide',
        time: userTime,
        agent_used: 'Clinical Support'
      };
      const updated = [...nextHistory, errMessage];
      setChatHistory(updated);
      persistSessionMessages(updated);
    } finally {
      setLoading(false);
    }
  };

  const handleCBTChipPress = (topic) => {
    return handleSendCBTMessage(topic, topic);
  };

  const sendMessage = async () => {
    if (message.trim().length === 0 || loading) return;

    const userMsgText = message.trim();
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMessage = {
      id: Date.now().toString(),
      text: userMsgText,
      sender: 'user',
      time: userTime
    };

    const nextHistory = [...chatHistory, newUserMessage];
    setChatHistory(nextHistory);
    persistSessionMessages(nextHistory);
    setMessage('');
    setLoading(true);

    // 0. Immediate Client-Side Clinical Emergency Interception Check
    if (distressKeywords.test(userMsgText)) {
      setShowEmergencyModal(true);
      setCrisisData({
        crisis_triggered: true,
        is_crisis: true,
        trigger_emergency: true,
        severity: 'CRITICAL',
        category: 'Immediate Risk / Self-Harm Prevention',
        message: 'We care deeply about your well-being. Immediate confidential clinical support is available right now.',
        helplines: [
          { name: 'National Mental Health Helpline', number: '1926' },
          { name: 'Sumithrayo Sri Lanka', number: '0112696666' }
        ]
      });
      const guideMessage = {
        id: (Date.now() + 1).toString(),
        text: 'We care deeply about your well-being. Immediate confidential clinical support is available right now.',
        sender: 'guide',
        time: userTime,
        isCrisis: true,
        agent_used: 'Crisis Intervention Agent'
      };
      const updatedWithCrisis = [...nextHistory, guideMessage];
      setChatHistory(updatedWithCrisis);
      persistSessionMessages(updatedWithCrisis);
    }

    try {
      // Convert history for backend payload
      const historyPayload = chatHistory.slice(-8).map((m) => ({
        sender: m.sender,
        text: typeof m.text === 'string' ? m.text : (m.cbtData?.cognitive_reframe || '')
      }));

      // Route all typed user messages directly to conversational chat endpoint (POST /user/chat)
      // to ensure students always receive a warm, natural empathetic chat reply
      const response = await sendChatMessage(userMsgText, historyPayload);
      const data = response?.data;

      // 🚨 CLINICAL CRISIS INTERVENTION INTERCEPTION
      if (data?.crisis_triggered || data?.is_crisis || data?.trigger_emergency || data?.severity === 'CRITICAL') {
        setCrisisData(data);
        setShowEmergencyModal(true);
        const guideMessage = {
          id: (Date.now() + 1).toString(),
          text: data.reply || data.message || "We care deeply about your well-being. Immediate confidential clinical support is available right now.",
          sender: 'guide',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isCrisis: true,
          agent_used: 'Crisis Intervention Agent'
        };
        const updated = [...nextHistory, guideMessage];
        setChatHistory(updated);
        persistSessionMessages(updated);
        return;
      }

      let guideText = "I'm right here with you. Tell me more about what's on your mind.";
      if (data?.reply) {
        guideText = typeof data.reply === 'object' ? data.reply.question || JSON.stringify(data.reply) : data.reply;
      } else if (data?.question) {
        guideText = typeof data.question === 'object' ? data.question.question || JSON.stringify(data.question) : data.question;
      }

      const inferredTool = data?.suggested_tool || inferToolFromContext(userMsgText + ' ' + guideText);

      // Normal typed message: Always deliver natural conversational reply bubble (isCBT: false)
      const guideMessage = {
        id: (Date.now() + 1).toString(),
        text: guideText,
        sender: 'guide',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agent_used: data?.agent_used || 'MindCare Support Guide',
        suggested_tool: inferredTool,
        isCBT: false,
      };

      const updated = [...nextHistory, guideMessage];
      setChatHistory(updated);
      persistSessionMessages(updated);
    } catch (error) {
      if (error?.response?.data?.crisis_triggered || error?.response?.data?.is_crisis || error?.response?.data?.trigger_emergency) {
        const cData = error.response.data;
        setCrisisData(cData);
        setShowEmergencyModal(true);
        const guideMessage = {
          id: (Date.now() + 1).toString(),
          text: cData.reply || cData.message || "We care deeply about your well-being. Immediate confidential clinical support is available right now.",
          sender: 'guide',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isCrisis: true,
          agent_used: 'Crisis Intervention Agent'
        };
        const updated = [...nextHistory, guideMessage];
        setChatHistory(updated);
        persistSessionMessages(updated);
        return;
      }
      console.error("Chat communication error:", error);
      const errMessage = {
        id: 'error-' + Date.now(),
        text: "I am experiencing network latency. All systems remain operational; please try sending your message again.",
        sender: 'guide',
        time: userTime,
        agent_used: 'Clinical Support'
      };
      const updated = [...nextHistory, errMessage];
      setChatHistory(updated);
      persistSessionMessages(updated);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Ambient Translucent Mint-Teal and Sky-Blue Circles (HomeScreen aesthetic) */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backBtn}
            accessibilityLabel="Go back"
            activeOpacity={0.8}
          >
            <ChevronLeft color="#0D9488" size={24} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Image source={AGENT_AVATAR} style={styles.headerAvatar} />
            <Text style={styles.headerTitle} numberOfLines={1}>MindCare Support</Text>
          </View>

          {/* Right Header Action Icons: History & New Chat */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setIsHistoryModalVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="Chat History"
            >
              <History size={19} color="#0D9488" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleStartNewChat}
              activeOpacity={0.7}
              accessibilityLabel="New Chat"
            >
              <SquarePen size={19} color="#0D9488" />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={chatHistory}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isUser = item.sender === 'user';
              if (isUser) {
                return (
                  <View style={[styles.messageWrapper, styles.userWrapper]}>
                    <View style={[styles.bubble, styles.userBubble]}>
                      <Text style={styles.userText}>
                        {typeof item.text === 'string' ? item.text : JSON.stringify(item.text)}
                      </Text>
                    </View>
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                );
              }

              return (
                <View style={[styles.messageWrapper, styles.botWrapper, item.isCBT && { maxWidth: '96%' }]}>
                  <View style={styles.botRow}>
                    <Image source={AGENT_AVATAR} style={styles.botAvatarMini} />
                    <View style={styles.botMessageContent}>
                      {item.isCBT ? (
                        <View style={styles.cbtCard}>
                          <View style={styles.cbtHeaderRow}>
                            <Text style={styles.cbtHeaderTitle}>REFRAME & RESET</Text>
                            <Text style={styles.cbtTopicBadge}>{item.cbtData?.topic || 'Perspective Shift'}</Text>
                          </View>

                          <View style={styles.cbtSection}>
                            <Text style={styles.cbtSectionLabel}>1. What's Weighing on You</Text>
                            <Text style={styles.cbtSectionText}>{item.cbtData?.thought_identification}</Text>
                          </View>

                          <View style={styles.cbtSection}>
                            <Text style={styles.cbtSectionLabel}>2. A Gentle Reality Check</Text>
                            <Text style={styles.cbtSectionText}>{item.cbtData?.reality_check}</Text>
                          </View>

                          <View style={[styles.cbtSection, { marginBottom: 0 }]}>
                            <Text style={styles.cbtSectionLabel}>3. Helpful Mindset Shift</Text>
                            <Text style={styles.cbtSectionText}>{item.cbtData?.cognitive_reframe}</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={[
                          styles.bubble, 
                          styles.botBubble,
                          item.isCrisis && styles.crisisBubble
                        ]}>
                          {item.isCrisis && (
                            <View style={styles.crisisBadgeRow}>
                              <AlertTriangle size={14} color="#E11D48" />
                              <Text style={styles.crisisBadgeText}>Immediate Help Available</Text>
                            </View>
                          )}
                          <Text style={[
                            styles.botText,
                            item.isCrisis && styles.crisisText
                          ]}>
                            {typeof item.text === 'string' ? item.text : JSON.stringify(item.text)}
                          </Text>
                        </View>
                      )}

                      {/* Bottom Action Row: Context-Aware Tool Shortcut & Save-to-Journal */}
                      <View style={styles.botFooterRow}>
                        {item.suggested_tool && (
                          <TouchableOpacity
                            style={styles.toolShortcutPill}
                            onPress={() => handleOpenTool(item.suggested_tool)}
                            activeOpacity={0.8}
                          >
                            {renderToolIcon(item.suggested_tool)}
                            <Text style={styles.toolShortcutText}>
                              {getToolLabel(item.suggested_tool)}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {!item.isCrisis && (
                          <TouchableOpacity
                            style={styles.saveToJournalBtn}
                            onPress={() => handleSaveToJournal(item)}
                            activeOpacity={0.7}
                          >
                            <Bookmark size={12} color="#0D9488" style={{ marginRight: 4 }} />
                            <Text style={styles.saveToJournalText}>Save to Journal</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={styles.timeText}>{item.time}</Text>
                    </View>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={loading && (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="small" color="#0D9488" />
                <Text style={styles.loadingText}>Synthesizing clinical response...</Text>
              </View>
            )}
          />

          {/* 4 CBT Quick Reframing Chips */}
          <View style={styles.cbtChipsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cbtChipsScroll}
            >
              {['Exam Anxiety', 'Deadline Pressure', 'Sleep & Burnout', 'Self-Doubt & Fear'].map((topic) => (
                <TouchableOpacity
                  key={topic}
                  style={styles.cbtChip}
                  onPress={() => handleCBTChipPress(topic)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cbtChipText}>{topic}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Bar */}
          <View style={[styles.inputWrapper, { marginBottom: isKeyboardVisible ? 10 : 88 }]}>
            <View style={styles.inputContainer}>
              <TextInput 
                style={styles.input}
                placeholder="Describe your current thoughts or feelings..."
                placeholderTextColor="#94A3B8"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={600}
              />
              <TouchableOpacity 
                style={[styles.sendBtn, (!message.trim() || loading) && styles.sendBtnDisabled]} 
                onPress={sendMessage}
                disabled={!message.trim() || loading}
                activeOpacity={0.8}
              >
                <Send color="#FFFFFF" size={17} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Multi-Session Chat History Modal */}
        <Modal
          visible={isHistoryModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsHistoryModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalHeaderTitleGroup}>
                  <History size={18} color="#0D9488" style={{ marginRight: 6 }} />
                  <Text style={styles.modalHeaderTitle}>Chat Sessions History</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setIsHistoryModalVisible(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.modalNewChatBtn}
                onPress={() => {
                  setIsHistoryModalVisible(false);
                  handleStartNewChat();
                }}
                activeOpacity={0.8}
              >
                <PlusCircle size={16} color="#0D9488" style={{ marginRight: 6 }} />
                <Text style={styles.modalNewChatBtnText}>Start New Conversation</Text>
              </TouchableOpacity>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sessionList}>
                {sessions.map((s) => {
                  const isActive = s.id === currentSessionId;
                  const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
                  const previewText = lastMsg ? (typeof lastMsg.text === 'string' ? lastMsg.text : 'Structured CBT Session') : 'No messages yet';
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.sessionCard, isActive && styles.sessionCardActive]}
                      onPress={() => handleSelectSession(s)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.sessionCardContent}>
                        <View style={styles.sessionCardTop}>
                          <Text style={[styles.sessionCardTitle, isActive && styles.sessionCardTitleActive]} numberOfLines={1}>
                            {s.title || 'Support Session'}
                          </Text>
                          {isActive && (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>Active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.sessionCardPreview} numberOfLines={2}>
                          {previewText}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteSessionBtn}
                        onPress={() => handleDeleteSession(s.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Trash2 size={16} color="#94A3B8" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Full-Screen Emergency / Critical Clinical Support Modal */}
        <EmergencyModal
          visible={showEmergencyModal}
          onClose={() => setShowEmergencyModal(false)}
          crisisData={crisisData}
          source="MindCare Support Sanctuary"
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F0F7F6',
    position: 'relative',
  },
  safeArea: {
    flex: 1,
  },

  // Ambient Orbs
  ambientOrbTop: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(204, 251, 241, 0.55)',
  },
  ambientOrbMiddle: {
    position: 'absolute',
    top: '35%',
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(224, 242, 254, 0.45)',
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: 80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(240, 253, 250, 0.60)',
  },

  // Header Bar
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    backgroundColor: 'rgba(255, 255, 255, 0.94)', 
    borderBottomWidth: 1.5, 
    borderBottomColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1, 
    marginLeft: 10 
  },
  headerAvatar: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    borderWidth: 1.5, 
    borderColor: '#0D9488', 
    marginRight: 9 
  },
  headerTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: { 
    padding: 16, 
    paddingBottom: 10 
  },
  messageWrapper: { 
    marginBottom: 14, 
    maxWidth: '84%' 
  },
  userWrapper: { 
    alignSelf: 'flex-end', 
    alignItems: 'flex-end' 
  },
  botWrapper: { 
    alignSelf: 'flex-start', 
    alignItems: 'flex-start' 
  },
  botRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  botAvatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#0D9488',
    marginTop: 2,
  },
  botMessageContent: {
    flex: 1,
  },

  // Active Agent Pill
  agentBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  agentDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0D9488',
    marginRight: 5,
  },
  agentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
    letterSpacing: 0.2,
  },

  bubble: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 18 
  },
  userBubble: { 
    backgroundColor: '#0D9488', 
    borderBottomRightRadius: 4,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2 
  },
  botBubble: { 
    backgroundColor: 'rgba(255, 255, 255, 0.92)', 
    borderBottomLeftRadius: 4, 
    borderWidth: 1.5, 
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2 
  },
  crisisBubble: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
  },
  crisisBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  crisisBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E11D48',
    letterSpacing: 0.3,
  },
  crisisText: {
    color: '#9F1239',
    lineHeight: 20,
    fontWeight: '600',
  },
  userText: { 
    color: '#FFFFFF', 
    fontSize: 14.5, 
    lineHeight: 21 
  },
  botText: { 
    color: '#0F172A', 
    fontSize: 14.5, 
    lineHeight: 21 
  },
  timeText: { 
    fontSize: 10, 
    color: '#94A3B8', 
    marginTop: 4, 
    marginHorizontal: 4 
  },

  // Tool Shortcut & Save-to-Journal Row
  botFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  toolShortcutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  toolShortcutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  saveToJournalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  saveToJournalText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },

  loadingWrapper: { 
    padding: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255, 255, 255, 0.90)', 
    alignSelf: 'flex-start', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    marginBottom: 10 
  },
  loadingText: { 
    marginLeft: 8, 
    fontSize: 12, 
    color: '#0D9488', 
    fontWeight: '600' 
  },

  // CBT Quick Chips
  cbtChipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cbtChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cbtChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 14,
    paddingVertical: 6.5,
    borderRadius: 16,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  cbtChipText: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '700',
  },

  // Input Bar
  inputWrapper: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9',
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F8FAFC', 
    borderRadius: 24, 
    paddingHorizontal: 14, 
    borderWidth: 1.5, 
    borderColor: '#E2E8F0' 
  },
  input: { 
    flex: 1, 
    paddingVertical: 9, 
    fontSize: 14.5, 
    color: '#1E293B', 
    maxHeight: 100 
  },
  sendBtn: { 
    backgroundColor: '#0D9488', 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 8 
  },
  sendBtnDisabled: { 
    backgroundColor: '#94A3B8', 
    opacity: 0.5 
  },

  // CBT Clinical Card Container
  cbtCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#0D9488',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cbtHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 10,
  },
  cbtHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  cbtTopicBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cbtSection: {
    marginBottom: 8,
  },
  cbtSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    marginBottom: 2,
  },
  cbtSectionText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },

  // History Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalNewChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 14,
  },
  modalNewChatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
  sessionList: {
    gap: 8,
    paddingBottom: 20,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sessionCardActive: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488',
  },
  sessionCardContent: {
    flex: 1,
    marginRight: 8,
  },
  sessionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sessionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  sessionCardTitleActive: {
    color: '#0D9488',
    fontWeight: '800',
  },
  activePill: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  sessionCardPreview: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  deleteSessionBtn: {
    padding: 6,
  },
});
