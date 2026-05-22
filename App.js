import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

// A public, short, freely-licensed MP3.
const AUDIO_URL = 'https://www.kozco.com/tech/piano2.wav';

const META = {
  title: 'Repro Track',
  artist: 'Repro Artist',
  artworkUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/200px-PNG_transparency_demonstration_1.png',
};

export default function App() {
  const player = useAudioPlayer(null);
  const [log, setLog] = useState([]);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const append = (line) => setLog((prev) => [`${new Date().toISOString().slice(11, 19)}  ${line}`, ...prev].slice(0, 50));

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      interruptionModeAndroid: 'doNotMix',
    })
      .then(() => append('audio mode set'))
      .catch((err) => append('audio mode err: ' + err.message));
  }, []);

  const startNormal = () => {
    try {
      player.replace({ uri: AUDIO_URL });
      player.play();
      player.setActiveForLockScreen(true, META, { showSeekForward: true, showSeekBackward: true });
      append('A: replace + play + setActive(true)');
    } catch (e) {
      append('A error: ' + e.message);
    }
  };

  // Scenario B: rapid toggle active/clear to maximise race chance against the service start
  const rapidToggle = async () => {
    try {
      player.replace({ uri: AUDIO_URL });
      player.play();
      for (let i = 0; i < 10; i++) {
        player.setActiveForLockScreen(true, META, { showSeekForward: true, showSeekBackward: true });
        player.clearLockScreenControls();
      }
      append('B: rapid setActive/clear x10 fired');
    } catch (e) {
      append('B error: ' + e.message);
    }
  };

  // Scenario C: setActive WITHOUT a loaded source first. Service starts but currentPlayer
  // may not be wired yet on the native side -> onStartCommand early-return -> no startForeground -> ANR/crash
  const activateBeforeSource = () => {
    try {
      player.setActiveForLockScreen(true, META, { showSeekForward: true, showSeekBackward: true });
      append('C: setActive(true) BEFORE replace/play');
    } catch (e) {
      append('C error: ' + e.message);
    }
  };

  // Scenario D: activate, immediately clear (simulates provider unmount during logout)
  const activateThenClear = () => {
    try {
      player.replace({ uri: AUDIO_URL });
      player.play();
      player.setActiveForLockScreen(true, META, { showSeekForward: true, showSeekBackward: true });
      // Same tick clear, like a provider tear-down racing the service start.
      player.clearLockScreenControls();
      append('D: setActive then immediate clear');
    } catch (e) {
      append('D error: ' + e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>expo-audio FG service repro</Text>
      <Text style={styles.sub}>Tap a scenario, then background the app (Home).</Text>
      <Text style={styles.sub}>Watch logcat for RemoteServiceException.</Text>
      <View style={styles.buttons}>
        <Button title="A: normal start (control)" onPress={startNormal} />
        <Button title="B: rapid setActive/clear x10" onPress={rapidToggle} />
        <Button title="C: setActive BEFORE replace" onPress={activateBeforeSource} />
        <Button title="D: setActive then immediate clear" onPress={activateThenClear} />
        <Button title="pause" onPress={() => { try { player.pause(); append('pause'); } catch (e) { append('pause err: ' + e.message); } }} />
      </View>
      <ScrollView style={styles.log}>
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>{line}</Text>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 16 },
  h1: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sub: { fontSize: 12, color: '#666' },
  buttons: { marginTop: 16, gap: 8 },
  log: { marginTop: 16, flex: 1, backgroundColor: '#f5f5f5', padding: 8 },
  logLine: { fontFamily: 'monospace', fontSize: 11, marginBottom: 2 },
});
