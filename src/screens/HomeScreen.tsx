import { useEffect, useState } from 'react';
import { Alert, Animated, Easing, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteUser, getAuth, signOut, type User } from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { BrandMark, BrandWordmark } from '../components/Brand';
import { getSurpriseSong, visibleGenres, type SongPick } from '../services/lastfm';
import { colors, fontFamily, spacing } from '../theme';

type Panel = 'saved' | 'account' | null;

/** A single, non-scrolling discovery surface. Account actions live in a sheet. */
export function HomeScreen({ user }: { user: User }) {
  const { width, height } = useWindowDimensions();
  const [song, setSong] = useState<SongPick | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasDiscovered, setHasDiscovered] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [favorites, setFavorites] = useState<SongPick[]>([]);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [stageReveal] = useState(() => new Animated.Value(0));
  const favoritesKey = `@lostfm/favorites/${user.uid}`;
  const artworkSize = Math.min(width - 112, height < 760 ? height * 0.25 : height * 0.27, 230);
  const liked = !!song && favorites.some((saved) => saved.url === song.url);
  const genreTags = song ? visibleGenres(song) : [];

  useEffect(() => {
    stageReveal.setValue(0);
    const entrance = Animated.timing(stageReveal, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [song?.url, stageReveal]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(favoritesKey).then((stored) => {
      if (!active || !stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) setFavorites(parsed.filter((item) => item && typeof item.url === 'string' && typeof item.title === 'string'));
    }).catch(() => {});
    return () => { active = false; };
  }, [favoritesKey]);

  /** Finish the exit animation before swapping the visible discovery stage. */
  function fadeOutStage(): Promise<void> {
    return new Promise((resolve) => {
      Animated.timing(stageReveal, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => resolve());
    });
  }

  /** Keep loading visible briefly so fast responses still produce a readable transition. */
  async function discoverSong() {
    if (loading) return;
    const previousUrl = song?.url;
    setHasDiscovered(true);
    setLoading(true);
    try {
      if (song) {
        await fadeOutStage();
        setSong(null);
      }
      const loadingStarted = Date.now();
      const next = await getSurpriseSong(previousUrl);
      const remaining = 750 - (Date.now() - loadingStarted);
      if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      await fadeOutStage();
      setArtworkFailed(false);
      setSong(next);
    } catch (error) {
      Alert.alert('Could not find a track', error instanceof Error ? error.message : 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite() {
    if (!song) return;
    const next = liked ? favorites.filter((item) => item.url !== song.url) : [song, ...favorites];
    setFavorites(next);
    try { await AsyncStorage.setItem(favoritesKey, JSON.stringify(next)); }
    catch { Alert.alert('Could not save this track', 'Please try again.'); }
  }

  async function openTrack() {
    if (!song) return;
    try { await Linking.openURL(song.url); }
    catch { Alert.alert('Could not open Last.fm', 'Please try again later.'); }
  }

  function confirmDeleteAccount() {
    Alert.alert('Delete account?', 'Your Firebase account will be permanently deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: deleteAccount },
    ]);
  }

  async function deleteAccount() {
    try { await deleteUser(user); }
    catch (error) {
      const code = (error as { code?: string })?.code;
      Alert.alert(code === 'auth/requires-recent-login' ? 'Sign in again' : 'Could not delete account',
        code === 'auth/requires-recent-login' ? 'For security, sign out and sign in again before deleting your account.' : error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.brand}><BrandMark size={46} /><BrandWordmark width={101} /></View>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Saved tracks" onPress={() => setPanel('saved')} style={styles.headerButton}><Ionicons name="heart-outline" size={22} color={colors.text} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Account menu" onPress={() => setPanel('account')} style={styles.headerButton}><Ionicons name="menu-outline" size={29} color={colors.text} /></Pressable>
        </View>
      </View>

      <View style={styles.stage}>
        <Animated.View style={[styles.stageContent, {
          opacity: stageReveal,
          transform: [
            { translateY: stageReveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            { scale: stageReveal.interpolate({ inputRange: [0, 1], outputRange: [0.975, 1] }) },
          ],
        }]}>
        {!song ? (
          <View style={styles.discovery}>
            {!hasDiscovered && !loading ? <View style={styles.welcome}>
              <Text style={styles.welcomeTitle}>Welcome to Lost.fm.</Text>
              <Text style={styles.welcomeSubtitle}>Ready to discover something new?</Text>
            </View> : null}
            <PulseButton onPress={discoverSong} loading={loading} />
            <Text style={styles.pulseCaption}>{loading ? 'Finding your next track' : 'Tap to find out'}</Text>
          </View>
        ) : (
          <View style={styles.result}>
            <View style={[styles.artworkFrame, { width: artworkSize, height: artworkSize }]}>
              <Image key={song.url} source={song.artworkUrl && !artworkFailed ? { uri: song.artworkUrl } : require('../../assets/cover-fallback.png')} onError={() => setArtworkFailed(true)} style={styles.artwork} resizeMode="cover" />
            </View>
            <Text numberOfLines={2} style={styles.songTitle}>{song.title}</Text>
            <Text numberOfLines={1} style={styles.artist}>{song.artist}</Text>
            <View style={styles.facts}>
              <View style={styles.fact}><Text style={styles.factLabel}>DURATION</Text><Text style={styles.factValue}>{formatDuration(song.durationMs)}</Text></View>
              {song.artistCountry ? <><View style={styles.factDivider} /><View style={styles.fact}><Text style={styles.factLabel}>ARTIST FROM</Text><Text numberOfLines={1} style={styles.factValue}>{song.artistCountry}</Text></View></> : null}
            </View>
            {genreTags.length ? <View style={styles.genreTags}>
              {genreTags.slice(0, height < 720 ? 2 : 3).map((genre) => <View key={genre} style={styles.genreTag}><Text numberOfLines={1} style={styles.genreTagText}>{formatGenre(genre)}</Text></View>)}
            </View> : null}
            <View style={styles.resultActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={liked ? 'Remove from saved tracks' : 'Save track'} onPress={toggleFavorite} style={({ pressed }) => [styles.sideAction, pressed && styles.actionPressed]}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={23} color={colors.text} /></Pressable>
              <PulseButton onPress={discoverSong} loading={loading} compact />
              <Pressable accessibilityRole="link" accessibilityLabel="Listen on Last.fm" onPress={openTrack} style={({ pressed }) => [styles.sideAction, pressed && styles.actionPressed]}><Ionicons name="headset-outline" size={24} color={colors.text} /></Pressable>
            </View>
          </View>
        )}
        </Animated.View>
      </View>

      <Modal visible={panel !== null} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setPanel(null)} accessibilityLabel="Close panel" />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{panel === 'saved' ? 'Saved tracks' : 'Account'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setPanel(null)}><Text style={styles.close}>×</Text></Pressable></View>
            {panel === 'saved' ? (
              favorites.length ? <ScrollView style={styles.savedList} contentContainerStyle={styles.savedContent}>
                {favorites.map((item) => <Pressable key={item.url} accessibilityRole="button" onPress={() => { setArtworkFailed(false); setSong(item); setPanel(null); }} style={styles.savedRow}>
                  <Image source={item.artworkUrl ? { uri: item.artworkUrl } : require('../../assets/cover-fallback.png')} style={styles.savedArtwork} />
                  <View style={styles.savedInfo}><Text numberOfLines={1} style={styles.savedTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.savedArtist}>{item.artist}</Text></View>
                  <Text style={styles.savedArrow}>›</Text>
                </Pressable>)}
              </ScrollView> : <Text style={styles.emptySaved}>Tracks you like will appear here.</Text>
            ) : (
              <View>
                <Text style={styles.accountEmail}>{user.email || 'Signed in with Google'}</Text>
                <Pressable accessibilityRole="button" onPress={() => signOut(getAuth())} style={styles.accountAction}><Text style={styles.accountActionText}>Sign out</Text><Text style={styles.actionArrow}>›</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={confirmDeleteAccount} style={styles.accountAction}><Text style={styles.deleteText}>Delete account</Text><Text style={styles.actionArrow}>›</Text></Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** The same tactile mark drives both the first discovery and subsequent ones. */
function PulseButton({ onPress, loading, compact = false }: { onPress: () => void; loading: boolean; compact?: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ringStyle = { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, compact ? 1.25 : 1.38] }) }] };
  return <View style={[styles.pulseArea, compact && styles.pulseAreaCompact]}>
    <Animated.View pointerEvents="none" style={[styles.outerRing, compact && styles.outerRingCompact, ringStyle]} />
    <View pointerEvents="none" style={[styles.innerRing, compact && styles.innerRingCompact]} />
    <Pressable accessibilityRole="button" accessibilityLabel={compact ? 'Discover another track' : 'Discover a track'} disabled={loading} onPress={onPress} style={({ pressed }) => [styles.pulseButton, compact && styles.pulseButtonCompact, pressed && styles.pulsePressed]}>
      <BrandMark size={compact ? 59 : 104} />
    </Pressable>
  </View>;
}

function formatDuration(milliseconds?: number): string {
  if (!milliseconds) return 'Unknown';
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatGenre(genre: string): string {
  const clean = genre.replace(/^#+/, '').replace(/_/g, ' ').trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Unknown genre';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 10 },
  header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  stageContent: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  discovery: { width: '100%', maxWidth: 320, alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  welcome: { position: 'absolute', top: -83, left: 0, right: 0, alignItems: 'center' },
  welcomeTitle: { color: colors.text, fontFamily, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' },
  welcomeSubtitle: { color: colors.muted, fontFamily, fontSize: 14, textAlign: 'center', marginTop: 6 },
  pulseArea: { width: 276, height: 276, alignItems: 'center', justifyContent: 'center' },
  pulseAreaCompact: { width: 136, height: 136 },
  outerRing: { width: 268, height: 268, borderRadius: 134, borderWidth: 1, borderColor: '#717171', position: 'absolute' },
  outerRingCompact: { width: 128, height: 128, borderRadius: 64 },
  innerRing: { width: 224, height: 224, borderRadius: 112, borderWidth: 1, borderColor: '#242424', position: 'absolute' },
  innerRingCompact: { width: 112, height: 112, borderRadius: 56 },
  pulseButton: { width: 184, height: 184, borderRadius: 92, borderWidth: 1, borderColor: '#555555', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pulseButtonCompact: { width: 94, height: 94, borderRadius: 47 },
  pulsePressed: { backgroundColor: colors.surfaceRaised },
  pulseCaption: { color: colors.muted, fontFamily, fontSize: 13, letterSpacing: 0.2, marginTop: 8 },
  result: { width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  artworkFrame: { backgroundColor: colors.surface, overflow: 'hidden', borderRadius: 4, marginBottom: 15 },
  artwork: { width: '100%', height: '100%' },
  songTitle: { color: colors.text, fontFamily, fontSize: 24, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center', maxWidth: '100%' },
  artist: { color: colors.muted, fontFamily, fontSize: 15, textAlign: 'center', marginTop: 4, maxWidth: '100%' },
  facts: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, marginTop: 16, minHeight: 39, maxWidth: '100%' },
  fact: { alignItems: 'center', maxWidth: '50%' },
  factLabel: { color: colors.subtle, fontFamily, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  factValue: { color: colors.text, fontFamily, fontSize: 14, fontWeight: '600', marginTop: 4 },
  factDivider: { width: 1, height: 28, backgroundColor: colors.border },
  genreTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 13, maxWidth: '100%' },
  genreTag: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '47%' },
  genreTagText: { color: colors.muted, fontFamily, fontSize: 11 },
  resultActions: { flexDirection: 'row', gap: 15, marginTop: 13, alignItems: 'center', justifyContent: 'center' },
  sideAction: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: '#3A3A3A', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, paddingHorizontal: spacing.lg, paddingTop: 23, paddingBottom: 40, maxHeight: '75%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { color: colors.text, fontFamily, fontSize: 24, fontWeight: '700' },
  close: { color: colors.muted, fontFamily, fontSize: 30, lineHeight: 34, width: 35, textAlign: 'right' },
  savedList: { flexGrow: 0 },
  savedContent: { paddingBottom: 4 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  savedArtwork: { width: 48, height: 48, borderRadius: 3, backgroundColor: colors.surfaceRaised },
  savedInfo: { flex: 1 },
  savedTitle: { color: colors.text, fontFamily, fontSize: 14, fontWeight: '600' },
  savedArtist: { color: colors.muted, fontFamily, fontSize: 12, marginTop: 3 },
  savedArrow: { color: colors.muted, fontFamily, fontSize: 26 },
  emptySaved: { color: colors.muted, fontFamily, fontSize: 14, paddingBottom: 10 },
  accountEmail: { color: colors.muted, fontFamily, fontSize: 13, marginBottom: 23 },
  accountAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 17, borderTopWidth: 1, borderTopColor: colors.border },
  accountActionText: { color: colors.text, fontFamily, fontSize: 15 },
  deleteText: { color: colors.muted, fontFamily, fontSize: 14 },
  actionArrow: { color: colors.subtle, fontFamily, fontSize: 24 },
});
