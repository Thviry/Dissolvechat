import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { createContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useIdentity } from '../src/hooks/useIdentity';
import { ThemeProvider, ThemeContext, SetThemeContext, ThemeNameContext } from '../src/theme/ThemeProvider';

export const AuthContext = createContext<ReturnType<typeof useIdentity> | null>(null);

// Re-export theme contexts so existing imports from '../_layout' keep working
export { ThemeContext, SetThemeContext, ThemeNameContext };

export default function RootLayout() {
  const auth = useIdentity();

  const [fontsLoaded] = useFonts({
    'IBMPlexMono-Bold': require('../assets/fonts/IBMPlexMono-Bold.ttf'),
    'IBMPlexMono-Regular': require('../assets/fonts/IBMPlexMono-Regular.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'JetBrainsMono-Regular': require('../assets/fonts/JetBrainsMono-Regular.ttf'),
  });

  if (!fontsLoaded || !auth.sessionChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#39ff14" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <ThemeProvider userId={auth.id || undefined}>
        <ThemeContext.Consumer>
          {(theme) => (
            <>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.void } }}>
                {auth.isReady ? (
                  <>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
                    <Stack.Screen name="create-group" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="group-info/[id]" options={{ presentation: 'card' }} />
                    <Stack.Screen name="add-contact" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="deeplink" options={{ presentation: 'transparentModal' }} />
                  </>
                ) : (
                  <>
                    <Stack.Screen name="welcome" />
                    <Stack.Screen name="create" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="recover" />
                    <Stack.Screen name="link-device" />
                  </>
                )}
              </Stack>
            </>
          )}
        </ThemeContext.Consumer>
      </ThemeProvider>
    </AuthContext.Provider>
  );
}
