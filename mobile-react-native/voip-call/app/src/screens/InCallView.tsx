import { useVoIP } from '@fishjam-cloud/react-native-client';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AudioCallView,
  CallControls,
  CallTimer,
  VideoCallView,
} from '../components';
import {
  useApplySystemHold,
  useApplySystemMute,
} from '../hooks/applySystemCallState';
import { AdditionalColors, BrandColors } from '../theme/colors';
import { useUser } from '../user/UserContext';

/** The active-call screen: picks the audio or video layout, and follows the system call state. */
export function InCallView() {
  const { currentCall } = useVoIP();
  const { username, avatarUrlFor } = useUser();

  useApplySystemHold();
  useApplySystemMute();

  if (!currentCall) return null;

  const { displayName, isVideo, startedAt } = currentCall;

  if (isVideo) {
    return (
      <View style={styles.videoRoot}>
        <StatusBar style="light" />
        <VideoCallView
          remoteName={displayName}
          remoteAvatarUrl={avatarUrlFor(displayName)}
          localName={username ?? 'You'}
          localAvatarUrl={username ? avatarUrlFor(username) : null}
        />
        <SafeAreaView
          style={[StyleSheet.absoluteFill, styles.overlay]}
          edges={['top', 'bottom']}
          pointerEvents="box-none">
          <View style={styles.videoHeader} pointerEvents="none">
            <Text style={styles.videoName}>{displayName}</Text>
            <CallTimer startedAt={startedAt} style={styles.videoTimer} />
          </View>
          <View style={styles.videoControls}>
            <CallControls isVideo />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.audioContent}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>On call ·</Text>
          <CallTimer startedAt={startedAt} style={styles.label} />
        </View>
        <AudioCallView calleeName={displayName} />
      </View>
      <View style={styles.audioControls}>
        <CallControls isVideo={false} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BrandColors.seaBlue20 },
  audioContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: {
    fontSize: 13,
    color: BrandColors.seaBlue100,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  audioControls: { paddingBottom: 24, alignItems: 'center' },
  videoRoot: { flex: 1, backgroundColor: BrandColors.darkBlue100 },
  overlay: { justifyContent: 'space-between' },
  videoHeader: { paddingTop: 8, alignItems: 'center' },
  videoName: { fontSize: 18, fontWeight: '700', color: AdditionalColors.white },
  videoTimer: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  videoControls: { alignItems: 'center', paddingBottom: 12 },
});
