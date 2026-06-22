import { useEffect } from "react";

export const useWakeLock = () => {
  useEffect(() => {
    const wakeLockAvailable = "wakeLock" in navigator;
    if (!wakeLockAvailable) {
      return;
    }

    const wakeLock = navigator.wakeLock.request("screen");

    return () => {
      wakeLock.then((sentinel) => sentinel.release());
    };
  }, []);
};
