import type { FC } from "react";

import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type SelectableDevice = {
  deviceId: string;
  label: string;
  kind?: string;
};

type Props = {
  devices: SelectableDevice[];
  onSelectDevice: (deviceId: string) => void;
  selectedDeviceId?: string;
};

export const DeviceSelect: FC<Props> = ({
  devices,
  onSelectDevice,
  selectedDeviceId,
}) => {
  const validDevices = devices.filter((device) => device.deviceId);

  if (!validDevices.length) {
    return <Label>No devices found, check browser permissions.</Label>;
  }

  return (
    <Select onValueChange={onSelectDevice} value={selectedDeviceId}>
      <SelectTrigger>
        <SelectValue placeholder="Select device" />
      </SelectTrigger>
      <SelectContent>
        {validDevices.map((device) => (
          <SelectItem key={device.deviceId} value={device.deviceId}>
            {device.label || `${device.kind} device`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
