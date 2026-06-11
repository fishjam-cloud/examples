import { QRCodeSVG } from 'qrcode.react';
import { Copy, Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';

import { DeviceSelect } from '@/components/DeviceSelect';
import VideoPlayer from '@/components/VideoPlayer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

import { BrandHeader } from './BrandHeader';
import { usePublisher } from './usePublisher';

const statusLabel = {
  connected: 'Live',
  connecting: 'Connecting',
  disconnected: 'Offline',
} as const;

export const PublisherPanel = () => {
  const {
    status,
    shareUrl,
    connectionStatus,
    cameraDevices,
    microphoneDevices,
    selectedCameraId,
    selectedMicrophoneId,
    previewStream,
    selectCamera,
    selectMicrophone,
    start,
    stop,
  } = usePublisher();

  const cameraPreview = previewStream && (
    <VideoPlayer
      className="aspect-video w-full rounded-md bg-stone-900 object-cover scale-x-[-1]"
      stream={previewStream}
    />
  );

  const isPublishing = status === 'publishing' && !!shareUrl;

  return (
    <div className="flex h-full w-full flex-col items-center overflow-auto px-4 py-8 md:py-16">
      <BrandHeader className="mb-8" />

      {isPublishing ? (
        <Card className="relative h-fit w-full max-w-lg">
          <Badge
            className="absolute right-6 top-6"
            variant={connectionStatus === 'connected' ? 'default' : 'outline'}>
            {statusLabel[connectionStatus]}
          </Badge>
          <CardHeader>
            <CardTitle>You are live</CardTitle>
            <CardDescription>Share the QR code or link so others can watch this stream.</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-6">
            {cameraPreview}

            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG value={shareUrl} size={180} />
            </div>

            <div className="flex w-full items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-stone-100 px-3 py-2 text-xs">{shareUrl}</code>
              <Button
                variant="outline"
                size="icon"
                title="Copy link"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast('Viewer link copied to clipboard', { position: 'top-center', duration: 1500 });
                }}>
                <Copy size={16} />
              </Button>
            </div>
          </CardContent>

          <CardFooter className="justify-end">
            <Button variant="destructive" className="!bg-[#DD6460] hover:!bg-[#DD6460]/90" onClick={stop}>
              Stop streaming
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="h-fit w-full max-w-lg">
          <CardHeader>
            <CardTitle>Start a stream</CardTitle>
            <CardDescription>
              Pick your camera and microphone, then go live!
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {cameraPreview}

            <div className="flex flex-col space-y-1.5">
              <Label>Camera</Label>
              <DeviceSelect devices={cameraDevices} onSelectDevice={selectCamera} selectedDeviceId={selectedCameraId} />
            </div>

            <div className="flex flex-col space-y-1.5">
              <Label>Microphone</Label>
              <DeviceSelect
                devices={microphoneDevices}
                onSelectDevice={selectMicrophone}
                selectedDeviceId={selectedMicrophoneId}
              />
            </div>
          </CardContent>

          <CardFooter className="justify-end">
            <Button className="gap-2" onClick={start} disabled={!previewStream}>
              {previewStream ? <Radio size={16} /> : <Loader2 className="animate-spin" size={16} />}
              <span>Start streaming</span>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};
