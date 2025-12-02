import type { DeviceItem } from '@fishjam-cloud/react-client';
import type { FC, PropsWithChildren } from 'react';

import { Label } from './ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from './ui/select';

type DeviceSelectProps = {
	placeholder: string;
	devices: DeviceItem[];
	onSelectDevice: (deviceId: string) => void;
	defaultDevice: DeviceItem | null;
};

export const DeviceSelect: FC<PropsWithChildren<DeviceSelectProps>> = ({
	placeholder,
	devices,
	onSelectDevice,
	defaultDevice,
	children,
}) => {
	const filteredDevices = devices.filter(
		(device, idx) =>
			device.deviceId &&
			devices.findIndex(({ deviceId }) => deviceId === device.deviceId) === idx,
	);

	if (!filteredDevices.length) {
		return <Label>No devices found, check browser permissions.</Label>;
	}

	return (
		<Select
			onValueChange={onSelectDevice}
			defaultValue={defaultDevice?.deviceId}
		>
			<SelectTrigger className="font-display">
				{children}
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent className="font-display">
				{filteredDevices.map((device) => (
					<SelectItem key={device.deviceId} value={device.deviceId}>
						{device.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
};
