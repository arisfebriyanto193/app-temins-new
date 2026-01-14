// File: app/AWS/index.tsx
import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AWSDashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'user_token',
        'user_data',
      ]);

      router.replace('/'); // kembali ke login
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Dashboard Info</Text>
      <Text>Monitoring Automatic Weather Station</Text>
      <Button title="Logout" onPress={handleLogout} color="red" />
    </View>
  );
}
