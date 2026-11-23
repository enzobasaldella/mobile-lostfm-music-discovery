import { useEffect } from 'react';
import { router } from 'expo-router';
import { HomeScreen } from '../screens/HomeScreen';
import { SessionLoader } from '../components/SessionLoader';
import { useFirebaseUser } from '../auth/useFirebaseUser';

/** Rota privada: devolve usuários sem sessão para a tela inicial. */
export default function HomeRoute() {
  const user = useFirebaseUser();

  useEffect(() => {
    if (user === null) router.replace('/');
  }, [user]);

  return user ? <HomeScreen user={user} /> : <SessionLoader />;
}
