import {
  useCamera,
  useMicrophone,
  useVoIP,
} from '@fishjam-cloud/react-native-client';
import { useEffect, useRef } from 'react';

// Sets aside the live devices when the call goes on hold and restores those devices on resume.
export function useApplySystemHold() {
  const { isOnHold } = useVoIP();
  const { isCameraOn, toggleCamera } = useCamera();
  const { isMicrophoneOn, toggleMicrophone } = useMicrophone();

  const heldMediaRef = useRef({
    microphoneEnabled: false,
    cameraEnabled: false,
  });
  const prevOnHoldRef = useRef(isOnHold);

  useEffect(() => {
    if (prevOnHoldRef.current === isOnHold) return;
    prevOnHoldRef.current = isOnHold;

    (async () => {
      if (isOnHold) {
        heldMediaRef.current = {
          microphoneEnabled: isMicrophoneOn,
          cameraEnabled: isCameraOn,
        };
        if (isMicrophoneOn) await toggleMicrophone();
        if (isCameraOn) await toggleCamera();
      } else {
        const { microphoneEnabled, cameraEnabled } = heldMediaRef.current;
        if (microphoneEnabled) await toggleMicrophone();
        if (cameraEnabled) await toggleCamera();
      }
    })().catch((err) =>
      console.error('[voip] failed to update media for held call:', err),
    );
  }, [isOnHold, isCameraOn, isMicrophoneOn, toggleCamera, toggleMicrophone]);
}

// Mirrors the system mute state (CallKit / Telecom) onto the microphone track.
export function useApplySystemMute() {
  const { isMuted } = useVoIP();
  const { isMicrophoneOn, toggleMicrophone } = useMicrophone();

  const prevMutedRef = useRef(isMuted);

  useEffect(() => {
    if (prevMutedRef.current === isMuted) return;
    prevMutedRef.current = isMuted;

    if (isMicrophoneOn !== isMuted) return;

    toggleMicrophone().catch((err) =>
      console.error('[voip] failed to sync mute state:', err),
    );
  }, [isMuted, isMicrophoneOn, toggleMicrophone]);
}
