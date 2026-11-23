import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from '@react-native-firebase/auth';

/** undefined: loading the session; null: signed out; User: authenticated. */
export function useFirebaseUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);

  return user;
}
