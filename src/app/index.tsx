import { useEffect } from 'react';
import { router } from 'expo-router';
import { AuthScreen } from '../screens/AuthScreen';
import { SessionLoader } from '../components/SessionLoader';
import { useFirebaseUser } from '../auth/useFirebaseUser';

/** Public route: show sign-in, then replace it with /home for active sessions. */
export default function SignInRoute() {
  const user = useFirebaseUser();

  useEffect(() => {
    if (user) router.replace('/home');
  }, [user]);

  return user === null ? <AuthScreen /> : <SessionLoader />;
}
