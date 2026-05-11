import * as SecureStore from 'expo-secure-store';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

const EMAIL_KEY = 'auth_email';
const PASS_KEY = 'auth_pass';
const WEDDING_KEY = 'auth_wedding_id';

export async function saveCredentials(email: string, password: string) {
  await Promise.all([
    SecureStore.setItemAsync(EMAIL_KEY, email),
    SecureStore.setItemAsync(PASS_KEY, password),
  ]);
}

export async function clearCredentials() {
  await Promise.all([
    SecureStore.deleteItemAsync(EMAIL_KEY),
    SecureStore.deleteItemAsync(PASS_KEY),
    SecureStore.deleteItemAsync(WEDDING_KEY),
  ]);
}

export async function tryAutoLogin(): Promise<boolean> {
  const [email, password] = await Promise.all([
    SecureStore.getItemAsync(EMAIL_KEY),
    SecureStore.getItemAsync(PASS_KEY),
  ]);
  if (!email || !password) return false;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return true;
  } catch {
    await clearCredentials();
    return false;
  }
}
