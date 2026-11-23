import { useEffect } from 'react';
import { router } from 'expo-router';
import { HomeScreen } from '../screens/HomeScreen';
import { SessionLoader } from '../components/SessionLoader';
import { useFirebaseUser } from '../auth/useFirebaseUser';

/** Private route: return signed-out users to the sign-in screen. */
export default function HomeRoute() {
  const user = useFirebaseUser();

  useEffect(() => {
    if (user === null) router.replace('/');
  }, [user]);

  return user ? <HomeScreen user={user} /> : <SessionLoader />;
}
