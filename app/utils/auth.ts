import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

type JwtPayload = {
  exp: number;
  uid: number;
  username: string;
  role: string;
  device_type?: string;
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const now = Date.now() / 1000; // detik
    return decoded.exp < now;
  } catch (e) {
    return true; // kalau token rusak → anggap expired
  }
};

export const logout = async () => {
  await AsyncStorage.removeItem('user_token');
  await AsyncStorage.removeItem('user_data');
};
