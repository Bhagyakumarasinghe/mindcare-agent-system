import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ChevronLeft, Bot } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChatScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { id: '1', text: "Hello! I'm your Mind Care AI assistant. How can I support you today?", sender: 'bot', time: '07:51 PM' }
  ]);
  
  const flatListRef = useRef();

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [chatHistory, loading]);

  const sendMessage = async () => {
    if (message.trim().length === 0) return;

    const userMsgText = message;
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

    try {
      const token = await AsyncStorage.getItem('userToken'); 
      const BACKEND_URL = "http://10.152.23.156:8000"; 

      const response = await fetch(`${BACKEND_URL}/user/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsgText, history: [] }),
      });

      const data = await response.json();

      if (response.ok) {
        let aiText = "";
        if (data.reply) {
            aiText = typeof data.reply === 'object' ? data.reply.question || JSON.stringify(data.reply) : data.reply;
        } else if (data.question) {
            aiText = typeof data.question === 'object' ? data.question.question || JSON.stringify(data.question) : data.question;
        } else {
            aiText = "I'm here to listen. Tell me more.";
        }

        const botMessage = {
          id: (Date.now() + 1).toString(),
          text: aiText,
          sender: 'bot',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatHistory(prev => [...prev, botMessage]);
      } else {
        throw new Error("Backend Error");
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setChatHistory(prev => [...prev, {
        id: 'error',
        text: "Connection trouble. Please check your backend.",
        sender: 'bot',
        time: userTime
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    // 1. Edge එක 'top' වලට විතරක් සීමා කළා
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#1F2937" size={28} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.botIconCircle}>
            <Bot size={20} color="#4F75FF" />
          </View>
          <Text style={styles.headerTitle}>AI Support Chat</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : null}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={chatHistory}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.messageWrapper, item.sender === 'user' ? styles.userWrapper : styles.botWrapper]}>
              <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.botBubble]}>
                <Text style={item.sender === 'user' ? styles.userText : styles.botText}>
                   {typeof item.text === 'string' ? item.text : JSON.stringify(item.text)}
                </Text>
              </View>
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={loading && (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="small" color="#4F75FF" />
              <Text style={styles.loadingText}>Thinking...</Text>
            </View>
          )}
        />

        {/* 2. Input Wrapper එකට Bottom Tab Bar එකේ ඉඩ ඉතිරි කළා */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input}
              placeholder="Type your message..."
              placeholderTextColor="#94A3B8"
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !message.trim() && { opacity: 0.5 }]} 
              onPress={sendMessage}
              disabled={loading}
            >
              <Send color="#FFF" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  botIconCircle: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  listContent: { padding: 20, paddingBottom: 10 },
  messageWrapper: { marginBottom: 15, maxWidth: '82%' },
  userWrapper: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  botWrapper: { alignSelf: 'flex-start' },
  bubble: { padding: 14, borderRadius: 20 },
  userBubble: { backgroundColor: '#4F75FF', borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, elevation: 1 },
  userText: { color: '#FFF', fontSize: 15 },
  botText: { color: '#1F2937', fontSize: 15 },
  timeText: { fontSize: 10, color: '#94A3B8', marginTop: 4, marginHorizontal: 5 },
  inputWrapper: { 
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFF', 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9',
    // 3. Tab Bar එක නිසා වැහෙන එක වළක්වන්න මේ margin එක වැදගත්
    marginBottom: Platform.OS === 'ios' ? 30 : 70 
  },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 25, paddingHorizontal: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1F2937' },
  sendBtn: { backgroundColor: '#4F75FF', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  loadingWrapper: { padding: 10, flexDirection: 'row', alignItems: 'center' },
  loadingText: { marginLeft: 8, fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }
});