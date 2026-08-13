import { sendApnsPush } from "./apns.ts";
import { sendFcmPush } from "./fcm.ts";

export type DevicePlatform = "ios" | "android";

export const isDevicePlatform = (value: unknown): value is DevicePlatform =>
  value === "ios" || value === "android";

export type PushParams = {
  token: string;
  roomName: string;
  displayName: string;
  isVideo: boolean;
  avatarUrl?: string;
};

/**
 * A push token is only valid with the service that issued it, so each device
 * records its platform at registration and is rung through the matching one.
 */
export const sendPush: Record<
  DevicePlatform,
  (params: PushParams) => Promise<void>
> = {
  ios: sendApnsPush,
  android: sendFcmPush,
};
