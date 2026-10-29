import React, { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ChevronLeft, MessageSquare, AlertTriangle, Settings } from 'lucide-react-native';
import { sendChatMessage, sendCBTChatMessage, getUserProfile } from '../api/authService';
import CrisisModal, { EmergencyModal } from '../components/CrisisModal';

// Academic distress & anxiety detector: identifies student distress related to exams, deadlines, grades
const isAcademicDistress = (text) => {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();

  // Direct distress phrases
  const directPhrases = [
    'fail my', 'failing my', 'going to fail', 'might fail', 'will fail', 'flunk',
    'overwhelmed by deadline', 'overwhelmed by deadlines', 'overwhelmed with deadline',
    'overwhelmed by exam', 'overwhelmed by exams', 'overwhelmed by work', 'overwhelmed by coursework',
    'exam anxiety', 'deadline pressure', 'academic pressure', 'academic stress',
    'falling behind', 'behind on', 'cannot pass', "can't pass", 'cant pass',
    'test anxiety', 'study stress', 'finals stress', 'midterm stress', 'burnout from studying'
  ];
  if (directPhrases.some((phrase) => lower.includes(phrase))) {
    return true;
  }

  // Combinations of distress keywords and academic keywords
  const distressWords = [
    'fail', 'failing', 'anxious', 'anxiety', 'panic', 'panicking',
    'scared', 'dread', 'overwhelmed', 'stressed', 'stress', 'stressing',
    'hopeless', 'worried', 'worrying', 'struggling', 'freeze', 'freezing'
  ];
  const academicWords = [
    'exam', 'exams', 'final', 'finals', 'midterm', 'midterms',
    'deadline', 'deadlines', 'assignment', 'assignments', 'coursework',
    'project', 'gpa', 'grade', 'grades', 'class', 'classes', 'test', 'tests'
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
  if (lower.includes('fail') || lower.includes('gpa') || lower.includes('grade') || lower.includes('doubt')) {
    return 'Performance Anxiety';
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

// Immediate High Distress & Self-Harm Detection Regex
const distressKeywords = /kill myself|end my life|suicide|hurt myself|want to die|self-harm|commit suicide|ending my life|cut myself|hang myself|take all my pills|overdose/i;

export default function ChatScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const isCrisisModalVisible = showEmergencyModal;
  const setIsCrisisModalVisible = setShowEmergencyModal;
  const [crisisData, setCrisisData] = useState(null);
  const [userId, setUserId] = useState('demo_user');
  const [chatHistory, setChatHistory] = useState([
    { 
      id: '1', 
      text: "Hello, I'm your MindCare Clinical Support Guide. How is your mind feeling today?", 
      sender: 'guide', 
      time: 'Clinical Guidance' 
    }
  ]);
  
  const flatListRef = useRef();

  useEffect(() => {
    getUserProfile().then(res => {
      if (res?.data?.id) setUserId(res.data.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [chatHistory, loading]);

  const handleSendCBTMessage = async (messageText, contextChip = null) => {
    if (loading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newUserMessage = {
      id: Date.now().toString(),
      text: contextChip ? `Clinical Focus: ${contextChip}` : messageText,
      sender: 'user',
      time: userTime
    };

    setChatHistory(prev => [...prev, newUserMessage]);
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
        isCrisis: true
      };
      setChatHistory(prev => [...prev, guideMessage]);
    }

    try {
      const response = await sendCBTChatMessage(userId, messageText, contextChip || messageText);
      const data = response?.data;

      // Clinical Crisis Interception (both crisis_triggered and is_crisis / trigger_emergency)
      if (data?.crisis_triggered || data?.is_crisis || data?.trigger_emergency || data?.severity === 'CRITICAL') {
        setCrisisData(data);
        setShowEmergencyModal(true);
        const guideMessage = {
          id: (Date.now() + 1).toString(),
          text: data.reply || data.message || "We care deeply about your well-being. Immediate confidential clinical support is available right now.",
          sender: 'guide',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isCrisis: true
        };
        setChatHistory(prev => [...prev, guideMessage]);
        return;
      }

      const guideMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'guide',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCBT: true,
        cbtData: {
          topic: contextChip || getAcademicTopicLabel(messageText),
          thought_identification: cleanCbtText(data?.thought_identification) || 'Automatic negative thinking and academic distortion detected.',
          reality_check: cleanCbtText(data?.reality_check) || 'What objective evidence challenges this worst-case scenario?',
          cognitive_reframe: cleanCbtText(data?.cognitive_reframe) || cleanCbtText(data?.reply) || 'Breaking preparation into sequential focus blocks restores executive control.'
        }
      };
      setChatHistory(prev => [...prev, guideMessage]);
    } catch (error) {
      console.error('CBT Generation Error:', error);
      setChatHistory(prev => [
        ...prev,
        {
          id: 'error-' + Date.now(),
          text: 'Unable to process CBT reframing at this moment. Please try sending a message directly.',
          sender: 'guide',
          time: userTime
        }
      ]);
    } finally {
      // Ensure loading indicator is removed immediately
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

    setChatHistory(prev => [...prev, newUserMessage]);
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
        isCrisis: true
      };
      setChatHistory(prev => [...prev, guideMessage]);
    }

    try {
      // Route Exam Distress & Academic Anxiety to Structured CBT Handler
      if (isAcademicDistress(userMsgText)) {
        try {
          const topicLabel = getAcademicTopicLabel(userMsgText);
          const response = await sendCBTChatMessage(userId, userMsgText, topicLabel);
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
              isCrisis: true
            };
            setChatHistory(prev => [...prev, guideMessage]);
            return;
          }

          const guideMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'guide',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isCBT: true,
            cbtData: {
              topic: topicLabel,
              thought_identification: cleanCbtText(data?.thought_identification) || 'Automatic catastrophizing and cognitive magnification.',
              reality_check: cleanCbtText(data?.reality_check) || 'What empirical evidence supports this catastrophic outcome versus a demanding challenge?',
              cognitive_reframe: cleanCbtText(data?.cognitive_reframe) || cleanCbtText(data?.reply) || 'Approaching preparation incrementally in focused 25-minute sprints makes the workload manageable.'
            }
          };
          setChatHistory(prev => [...prev, guideMessage]);
          return;
        } catch (cbtErr) {
          console.error("CBT distress handler error, falling back to standard chat:", cbtErr);
          // Fall through to general chat pipeline if CBT endpoint fails
        }
      }

      const response = await sendChatMessage(userMsgText, []);
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
          isCrisis: true
        };
        setChatHistory(prev => [...prev, guideMessage]);
        return;
      }

      let guideText = "I'm here to listen. Tell me more about what you're experiencing.";
      if (data?.reply) {
        guideText = typeof data.reply === 'object' ? data.reply.question || JSON.stringify(data.reply) : data.reply;
      } else if (data?.question) {
        guideText = typeof data.question === 'object' ? data.question.question || JSON.stringify(data.question) : data.question;
      }

      const guideMessage = {
        id: (Date.now() + 1).toString(),
        text: guideText,
        sender: 'guide',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, guideMessage]);
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
          isCrisis: true
        };
        setChatHistory(prev => [...prev, guideMessage]);
        return;
      }
      console.error("Chat communication error:", error);
      setChatHistory(prev => [...prev, {
        id: 'error-' + Date.now(),
        text: "I am experiencing network latency. All systems remain operational; please try sending your message again.",
        sender: 'guide',
        time: userTime
      }]);
    } finally {
      // Ensure loading indicator is removed immediately
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <ChevronLeft color="#0D9488" size={26} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={styles.iconCircle}>
            <MessageSquare size={18} color="#0D9488" />
          </View>
          <View>
            <Text style={styles.headerTitle}>MindCare Clinical Support</Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>Active Guidance</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerGearBtn}
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          activeOpacity={0.7}
          accessibilityLabel="Settings"
        >
          <Settings size={18} color="#0D9488" />
        </TouchableOpacity>
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
          renderItem={({ item }) => (
            <View style={[styles.messageWrapper, item.sender === 'user' ? styles.userWrapper : styles.botWrapper, item.isCBT && { maxWidth: '94%' }]}>
              {item.isCBT ? (
                <View style={styles.cbtCard}>
                  <View style={styles.cbtHeaderRow}>
                    <Text style={styles.cbtHeaderTitle}>CBT CLINICAL REFRAME</Text>
                    <Text style={styles.cbtTopicBadge}>{item.cbtData?.topic || 'Cognitive Restructuring'}</Text>
                  </View>

                  <View style={styles.cbtSection}>
                    <Text style={styles.cbtSectionLabel}>1. Thought Identification</Text>
                    <Text style={styles.cbtSectionText}>{item.cbtData?.thought_identification}</Text>
                  </View>

                  <View style={styles.cbtSection}>
                    <Text style={styles.cbtSectionLabel}>2. Reality & Evidence Check</Text>
                    <Text style={styles.cbtSectionText}>{item.cbtData?.reality_check}</Text>
                  </View>

                  <View style={[styles.cbtSection, { marginBottom: 0 }]}>
                    <Text style={styles.cbtSectionLabel}>3. Cognitive Reframe</Text>
                    <Text style={styles.cbtSectionText}>{item.cbtData?.cognitive_reframe}</Text>
                  </View>
                </View>
              ) : (
                <View style={[
                  styles.bubble, 
                  item.sender === 'user' ? styles.userBubble : styles.botBubble,
                  item.isCrisis && styles.crisisBubble
                ]}>
                  {item.isCrisis && (
                    <View style={styles.crisisBadgeRow}>
                      <AlertTriangle size={14} color="#E11D48" />
                      <Text style={styles.crisisBadgeText}>Immediate Help Available</Text>
                    </View>
                  )}
                  <Text style={[
                    item.sender === 'user' ? styles.userText : styles.botText,
                    item.isCrisis && styles.crisisText
                  ]}>
                    {typeof item.text === 'string' ? item.text : JSON.stringify(item.text)}
                  </Text>
                </View>
              )}
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={loading && (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="small" color="#0D9488" />
              <Text style={styles.loadingText}>Synthesizing clinical response...</Text>
            </View>
          )}
        />

        {/* CBT Quick Reframing Chips */}
        <View style={styles.cbtChipsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cbtChipsScroll}
          >
            <TouchableOpacity
              style={styles.cbtChip}
              onPress={() => handleCBTChipPress('Exam Anxiety')}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cbtChipText}>Exam Anxiety</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cbtChip}
              onPress={() => handleCBTChipPress('Deadline Pressure')}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cbtChipText}>Deadline Pressure</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cbtChip}
              onPress={() => handleCBTChipPress('Self-Doubt & Fear')}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cbtChipText}>Self-Doubt & Fear</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={styles.inputWrapper}>
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
            >
              <Send color="#FFFFFF" size={18} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Full-Screen Emergency / Critical Clinical Support Modal */}
      <EmergencyModal
        visible={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        crisisData={crisisData}
        source="MindCare Support Sanctuary"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: '#FFFFFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  backBtn: {
    padding: 4
  },
  headerInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1, 
    marginLeft: 8 
  },
  iconCircle: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    backgroundColor: '#E6F4F1', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 10 
  },
  headerTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#1E293B' 
  },
  statusRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 2 
  },
  onlineDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: '#10B981', 
    marginRight: 6 
  },
  statusText: { 
    fontSize: 11, 
    color: '#0D9488', 
    fontWeight: '600' 
  },
  headerBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#E6F4F1', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12, 
    gap: 4 
  },
  headerBadgeText: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#0F766E' 
  },
  headerGearBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { 
    padding: 16, 
    paddingBottom: 10 
  },
  messageWrapper: { 
    marginBottom: 14, 
    maxWidth: '82%' 
  },
  userWrapper: { 
    alignSelf: 'flex-end', 
    alignItems: 'flex-end' 
  },
  botWrapper: { 
    alignSelf: 'flex-start', 
    alignItems: 'flex-start' 
  },
  bubble: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 18 
  },
  userBubble: { 
    backgroundColor: '#0D9488', 
    borderBottomRightRadius: 4 
  },
  botBubble: { 
    backgroundColor: '#FFFFFF', 
    borderBottomLeftRadius: 4, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    elevation: 1 
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
    fontSize: 15, 
    lineHeight: 22 
  },
  botText: { 
    color: '#1E293B', 
    fontSize: 15, 
    lineHeight: 22 
  },
  timeText: { 
    fontSize: 10, 
    color: '#94A3B8', 
    marginTop: 4, 
    marginHorizontal: 4 
  },
  loadingWrapper: { 
    padding: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
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
    fontWeight: '500' 
  },
  inputWrapper: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9',
    marginBottom: Platform.OS === 'ios' ? 25 : 65 
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
    paddingVertical: 10, 
    fontSize: 15, 
    color: '#1E293B', 
    maxHeight: 100 
  },
  sendBtn: { 
    backgroundColor: '#0D9488', 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 8 
  },
  sendBtnDisabled: { 
    backgroundColor: '#94A3B8', 
    opacity: 0.5 
  },
  // CBT Quick Chips
  cbtChipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
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
    paddingVertical: 7,
    borderRadius: 18,
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
  // CBT Clinical Card Container (Teal #0D9488 left border accent, strictly plain text)
  cbtCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#0D9488',
    borderRadius: 12,
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
});