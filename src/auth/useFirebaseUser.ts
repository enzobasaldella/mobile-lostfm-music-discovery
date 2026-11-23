import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from '@react-native-firebase/auth';

/** undefined: consultando a sessão; null: sem login; User: autenticado. */
export function useFirebaseUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);

  return user;
}
