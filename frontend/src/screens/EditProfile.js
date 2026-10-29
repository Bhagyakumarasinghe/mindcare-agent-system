import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { updateProfile } from '../api/authService';

export default function EditProfileScreen({ navigation }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        if (!name.trim()) {
            Alert.alert("Input Required", "Please enter a valid name.");
            return;
        }

        setLoading(true);
        try {
            await updateProfile({ name: name.trim() }); 
            Alert.alert("Success", "Profile updated successfully!");
            navigation.goBack();
        } catch (error) {
            Alert.alert("Error", "Update failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft color="#0D9488" size={24} />
                </TouchableOpacity>

                <Text style={styles.title}>Edit Profile Name</Text>
                <Text style={styles.label}>New Name</Text>
                <TextInput 
                    style={styles.input} 
                    value={name} 
                    onChangeText={setName} 
                    placeholder="Enter your new name"
                    placeholderTextColor="#94A3B8"
                    autoFocus={true}
                />
                <TouchableOpacity style={styles.button} onPress={handleUpdate} disabled={loading} activeOpacity={0.85}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save Changes</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 24 },
    backBtn: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#475569', textTransform: 'uppercase' },
    input: { borderWidth: 1.5, borderColor: '#E2E8F0', padding: 15, borderRadius: 14, marginBottom: 24, backgroundColor: '#FFFFFF', fontSize: 16, color: '#1E293B' },
    button: { backgroundColor: '#0D9488', padding: 18, borderRadius: 16, alignItems: 'center' },
    buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});