import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfile } from '../api/authService'; // මේ function එක ඔයාගේ authService එකට දාන්න

export default function EditProfileScreen({ navigation }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        if (!name) {
            Alert.alert("Error", "Please enter a name.");
            return;
        }

        setLoading(true);
        try {
            // මෙතනදී අපි backend එකට දත්ත යවනවා
            await updateProfile({ name: name }); 
            Alert.alert("Success", "Profile updated successfully!");
            navigation.goBack(); // නැවත Profile screen එකට යෑම
        } catch (error) {
            Alert.alert("Error", "Update failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.label}>New Name</Text>
                <TextInput 
                    style={styles.input} 
                    value={name} 
                    onChangeText={setName} 
                    placeholder="Enter your new name"
                />
                <TouchableOpacity style={styles.button} onPress={handleUpdate} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save Changes</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    content: { padding: 20 },
    label: { fontSize: 16, marginBottom: 8, color: '#1E293B' },
    input: { borderWidth: 1, borderColor: '#E2E8F0', padding: 15, borderRadius: 12, marginBottom: 20 },
    button: { backgroundColor: '#7D9CFF', padding: 18, borderRadius: 12, alignItems: 'center' },
    buttonText: { color: '#FFF', fontWeight: 'bold' }
});