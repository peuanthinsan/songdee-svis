import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_KEY = 'svis_auth_token';
export const AUTH_USER_KEY = 'svis_auth_user';

const LEGACY_TOKEN_KEY = 'auth_token';
const LEGACY_USER_KEY = 'auth_user';

async function readAndMigrate(currentKey: string, legacyKey: string): Promise<string | null> {
  const currentValue = await SecureStore.getItemAsync(currentKey);
  if (currentValue) return currentValue;

  const legacyValue = await SecureStore.getItemAsync(legacyKey);
  if (!legacyValue) return null;

  await SecureStore.setItemAsync(currentKey, legacyValue);
  await SecureStore.deleteItemAsync(legacyKey);
  return legacyValue;
}

export function readAuthToken(): Promise<string | null> {
  return readAndMigrate(AUTH_TOKEN_KEY, LEGACY_TOKEN_KEY);
}

export function readAuthUser(): Promise<string | null> {
  return readAndMigrate(AUTH_USER_KEY, LEGACY_USER_KEY);
}

export async function clearAuthStorage(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
    SecureStore.deleteItemAsync(AUTH_USER_KEY),
    SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_USER_KEY),
  ]);
}
