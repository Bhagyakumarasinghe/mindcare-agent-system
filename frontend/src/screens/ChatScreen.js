import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ChevronLeft, Bot } from 'lucide-react-native';

export default function ChatScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { id: '1', text: "Hello! I'm your Mind Care AI assistant. How can I support you today?", sender: 'bot', time: '07:51 PM' }
  ]);

  const sendMessage = () => {
    if (message.trim().length > 0) {
      const newMessage = {
        id: Date.now().toString(),
        text: message,
        sender: 'user',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory([...chatHistory, newMessage]);
      setMessage('');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
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

      {/* Messages */}
      <FlatList
        data={chatHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.messageWrapper, item.sender === 'user' ? styles.userWrapper : styles.botWrapper]}>
            <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.botBubble]}>
              <Text style={item.sender === 'user' ? styles.userText : styles.botText}>{item.text}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />

      {/* Input Area - Tab Bar එකට ඉහළින් රැඳෙන ලෙස සකසා ඇත */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 80}
      >
        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input}
              placeholder="Type your message..."
              placeholderTextColor="#94A3B8"
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
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
  listContent: { padding: 20, paddingBottom: 100 },
  messageWrapper: { marginBottom: 15, maxWidth: '82%' },
  userWrapper: { alignSelf: 'flex-end' },
  botWrapper: { alignSelf: 'flex-start' },
  bubble: { padding: 14, borderRadius: 20 },
  userBubble: { backgroundColor: '#4F75FF', borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, elevation: 1 },
  userText: { color: '#FFF' },
  botText: { color: '#1F2937' },
  inputWrapper: { 
    padding: 10, 
    backgroundColor: '#FFF', 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9',
    marginBottom: 70 // Tab Bar එකේ උසට සමාන ඉඩක් යටින් තැබීම
  },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 25, paddingHorizontal: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  input: { flex: 1, paddingVertical: 10, fontSize: 16, color: '#1F2937' },
  sendBtn: { backgroundColor: '#4F75FF', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});