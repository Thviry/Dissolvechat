import { Redirect } from 'expo-router';
import { useContext } from 'react';
import { AuthContext } from './_layout';

export default function Index() {
  const auth = useContext(AuthContext);

  if (auth?.isReady) {
    return <Redirect href="/(tabs)/chats" />;
  }
  return <Redirect href="/welcome" />;
}
