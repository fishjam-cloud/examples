import { Signal } from "@moq/signals";
import * as Publish from "@moq/publish";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator";

import type { MoqConnectionStatus } from "@/utils/types";
import { useSignalValue } from "@/hooks/useSignalValue";
import { useMoqTokens } from "@/hooks/useMoqTokens";

// A friendly, human-shareable stream name (e.g. "brave-otter") used as the broadcast's
// last path segment. Word-only (no digits) so it stays easy to read off a screen or say aloud.
const generateStreamName = () =>
  uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: "-",
    length: 2,
  });

// Builds the in-app viewer link encoded in the QR code.
const buildShareUrl = (streamName: string) =>
  `${window.location.origin}/watch/${streamName}`;

export const usePublisher = () => {
  const [camera] = useState(() => new Publish.Source.Camera({ enabled: true }));
  const [microphone] = useState(
    () => new Publish.Source.Microphone({ enabled: true }),
  );
  const [connectionSignal] = useState(
    () =>
      new Signal<Publish.Lite.Connection.Established | undefined>(undefined),
  );

  const [streamName, setStreamName] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<MoqConnectionStatus>("disconnected");

  const { authorizeConnection } = useMoqTokens();

  // Holds the teardown for the active session; its presence also means "already publishing".
  const sessionCleanupRef = useRef<(() => void) | null>(null);

  const cameraDevices = useSignalValue(camera.device.available) ?? [];
  const microphoneDevices = useSignalValue(microphone.device.available) ?? [];
  const selectedCameraId = useSignalValue(camera.device.active);
  const selectedMicrophoneId = useSignalValue(microphone.device.active);

  const cameraTrack = useSignalValue(camera.source);
  const previewStream = useMemo(
    () => (cameraTrack ? new MediaStream([cameraTrack]) : null),
    [cameraTrack],
  );

  const selectCamera = useCallback(
    (deviceId: string) => camera.device.preferred.set(deviceId),
    [camera],
  );
  const selectMicrophone = useCallback(
    (deviceId: string) => microphone.device.preferred.set(deviceId),
    [microphone],
  );

  const stopPublishing = useCallback(() => {
    sessionCleanupRef.current?.();
    sessionCleanupRef.current = null;
    connectionSignal.set(undefined);
    setConnectionStatus("disconnected");
    setStreamName(null);
  }, [connectionSignal]);

  const start = useCallback(async () => {
    if (sessionCleanupRef.current) {
      return;
    }

    const name = generateStreamName();

    // Claim the publishing slot synchronously so a second click — or a stop pressed while the
    // token is still being fetched — is handled correctly. The placeholder is replaced with
    // the real teardown once the connection is set up.
    let cancelled = false;
    sessionCleanupRef.current = () => {
      cancelled = true;
    };

    setStreamName(name);
    setConnectionStatus("connecting");

    let connectionUrl: URL;
    try {
      connectionUrl = await authorizeConnection(name, "publisher");
    } catch (error) {
      if (!cancelled) {
        stopPublishing();
        toast.error(
          "Could not start the stream — failed to fetch a MoQ token.",
        );
      }
      console.error(error);
      return;
    }

    // Stopped while the token was being fetched: abort before opening a connection.
    if (cancelled) {
      return;
    }

    const reload = new Publish.Lite.Connection.Reload({
      enabled: true,
      url: connectionUrl,
    });

    const disposeStatus = reload.status.subscribe(setConnectionStatus);
    const disposeEstablished = reload.established.subscribe((connection) => {
      connectionSignal.set(connection);
    });

    // Single-segment broadcast leaf; the `translations` namespace is in the connection URL.
    // The hd/sd video and audio encoders must be explicitly enabled (with a config),
    // otherwise the catalog publishes with no active tracks and the relay aborts it.
    const broadcast = new Publish.Broadcast({
      connection: connectionSignal,
      enabled: true,
      name: Publish.Lite.Path.from(name),
      audio: {
        enabled: microphone.enabled,
        source: microphone.source,
      },
      video: {
        source: camera.source,
        // Single 720p rendition; the lower-quality sd encoder stays off.
        hd: {
          enabled: camera.enabled,
          config: {
            maxPixels: 1280 * 720,
            maxBitrate: 1_000_000,
            frameRate: 30,
          },
        },
        sd: { enabled: false },
      },
    });

    sessionCleanupRef.current = () => {
      disposeEstablished();
      disposeStatus();
      broadcast.close();
      reload.close();
    };
  }, [
    authorizeConnection,
    camera,
    connectionSignal,
    microphone,
    stopPublishing,
  ]);

  // Tear down the broadcast and release the camera/microphone when the panel unmounts.
  useEffect(() => {
    return () => {
      sessionCleanupRef.current?.();
      camera.close();
      microphone.close();
    };
  }, [camera, microphone]);

  return {
    shareUrl: streamName ? buildShareUrl(streamName) : null,
    connectionStatus,
    cameraDevices,
    microphoneDevices,
    selectedCameraId,
    selectedMicrophoneId,
    previewStream,
    selectCamera,
    selectMicrophone,
    start,
    stop: stopPublishing,
  };
};
