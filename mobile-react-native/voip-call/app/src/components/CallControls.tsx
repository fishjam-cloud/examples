import {
  setCallMuted,
  useAudioOutput,
  useCamera,
  useMicrophone,
  useVoIP,
} from '@fishjam-cloud/react-native-client';
import { useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { InCallButton } from './InCallButton';

type CallControlsProps = {
  isVideo: boolean;
};

/** The in-call button bar. */
export function CallControls({ isVideo }: CallControlsProps) {
  const { endCall, isOnHold, setCallHeld } = useVoIP();
  const { isMicrophoneOn, toggleMicrophone } = useMicrophone();
  const { isCameraOn, toggleCamera } = useCamera();
  const { currentAudioOutput, availableAudioOutputs, ios, android } =
    useAudioOutput();

  const isSpeaker = currentAudioOutput?.type === 'speaker';
  const isBluetooth = currentAudioOutput?.type === 'bluetooth';
  const bluetoothDevice = availableAudioOutputs.find(
    (device) => device.type === 'bluetooth',
  );

  const handleToggleMute = useCallback(() => {
    const willBeMuted = isMicrophoneOn;
    toggleMicrophone()
      .then(() => setCallMuted(willBeMuted))
      .catch((err) => console.warn('Failed to toggle mute:', err));
  }, [isMicrophoneOn, toggleMicrophone]);

  const toggleSpeaker = useCallback(() => {
    if (Platform.OS === 'ios') {
      ios
        .overrideAudioOutput(isSpeaker ? 'none' : 'speaker')
        .catch((err) => console.warn('Failed to switch audio output:', err));
      return;
    }
    const target = availableAudioOutputs.find(
      (device) => device.type === (isSpeaker ? 'earpiece' : 'speaker'),
    );
    if (target) {
      android
        .selectAudioOutput(target.id)
        .catch((err) => console.warn('Failed to switch audio output:', err));
    }
  }, [android, availableAudioOutputs, ios, isSpeaker]);

  const selectBluetooth = useCallback(() => {
    if (Platform.OS === 'ios') {
      ios
        .overrideAudioOutput('none')
        .catch((err) => console.warn('Failed to switch audio output:', err));
      return;
    }
    if (bluetoothDevice) {
      android
        .selectAudioOutput(bluetoothDevice.id)
        .catch((err) => console.warn('Failed to switch audio output:', err));
    }
  }, [android, bluetoothDevice, ios]);

  const toggleHold = useCallback(() => {
    setCallHeld(!isOnHold).catch((err) =>
      console.warn('Failed to change held state:', err),
    );
  }, [isOnHold, setCallHeld]);

  const handleEndCall = useCallback(() => {
    void endCall('local');
  }, [endCall]);

  return (
    <View style={styles.controls}>
      <InCallButton
        iconName={isMicrophoneOn ? 'microphone' : 'microphone-off'}
        active={!isMicrophoneOn}
        onPress={handleToggleMute}
        accessibilityLabel="Toggle microphone"
        disabled={isOnHold}
      />
      {isVideo && (
        <InCallButton
          iconName={isCameraOn ? 'camera' : 'camera-off'}
          active={!isCameraOn}
          onPress={toggleCamera}
          accessibilityLabel="Toggle camera"
          disabled={isOnHold}
        />
      )}
      <InCallButton
        iconName={isSpeaker ? 'volume-high' : 'volume-medium'}
        active={isSpeaker}
        onPress={toggleSpeaker}
        accessibilityLabel="Toggle speaker"
        disabled={isOnHold}
      />
      {bluetoothDevice && (
        <InCallButton
          iconName="bluetooth-audio"
          active={isBluetooth}
          onPress={selectBluetooth}
          accessibilityLabel="Route audio to Bluetooth"
          disabled={isOnHold || isBluetooth}
        />
      )}
      <InCallButton
        iconName={isOnHold ? 'play' : 'pause'}
        active={isOnHold}
        onPress={toggleHold}
        accessibilityLabel={isOnHold ? 'Resume call' : 'Hold call'}
      />
      <InCallButton
        type="disconnect"
        iconName="phone-hangup"
        onPress={handleEndCall}
        accessibilityLabel="End call"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 40,
    alignItems: 'center',
  },
});
