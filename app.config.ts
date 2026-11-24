import type { ExpoConfig, ConfigContext } from 'expo/config';

// app.config.ts runs in Node; avoid a project-wide Node type dependency.
declare const process: { env: Record<string, string | undefined> };

/** Combine app.json with Android identity, native plugins, and build-time values. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Lost.fm',
  slug: 'lost-fm',
  version: '1.0.2',
  githubUrl: 'https://github.com/enzobasaldella/mobile-lostfm-music-discovery',
  platforms: ['android'],
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  scheme: 'lostfm',
  icon: './assets/lostfm-mark.png',
  android: {
    ...config.android,
    versionCode: 3,
    package: 'enzo.basaldella.lostfm',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/lostfm-mark.png',
      backgroundColor: '#000000',
      monochromeImage: './assets/lostfm-mark.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    '@react-native-firebase/app',
    '@react-native-google-signin/google-signin',
    ['expo-splash-screen', { image: './assets/lostfm-mark.png', imageWidth: 180, resizeMode: 'contain', backgroundColor: '#000000' }],
    ['expo-build-properties', { android: { minSdkVersion: 24, kotlinVersion: '2.4.0' } }],
  ],
  extra: {
    ...config.extra,
    lastFmApiKey: process.env.EXPO_PUBLIC_LASTFM_API_KEY,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  },
});
