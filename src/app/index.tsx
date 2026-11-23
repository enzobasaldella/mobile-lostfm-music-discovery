import { useEffect } from 'react';
import { router } from 'expo-router';
import { AuthScreen } from '../screens/AuthScreen';
import { SessionLoader } from '../components/SessionLoader';
import { useFirebaseUser } from '../auth/useFirebaseUser';

/** Rota inicial: mostra autenticação e leva a sessão ativa para /home. */
export default function SignInRoute() {
  const user = useFirebaseUser();

  useEffect(() => {
    if (user) router.replace('/home');
  }, [user]);

  return user === null ? <AuthScreen /> : <SessionLoader />;
}
