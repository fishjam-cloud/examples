import { Check } from "lucide-react";
import type { FC } from "react";
import { useEffect, useState } from "react";
import CopyButton from "./CopyButton";
import HowItWorks from "./HowItWorks";
import HowToPlay from "./HowToPlay";
import StorySelectionPanel from "./StorySelectionPanel";
import { Button } from "./ui/button";
import { toast } from "./ui/sonner";
import { useTRPCClient } from "@/contexts/trpc";

export type RoomControlsProps = {
  roomId: string;
};

const RoomControls: FC<RoomControlsProps> = ({ roomId }) => {
  const url = `https://deepsea.fishjam.io/${roomId}`;
  const [isStoryPanelOpen, setIsStoryPanelOpen] = useState(false);
  const trpc = useTRPCClient();

  useEffect(() => {
    void trpc.getStories.query();
  }, [trpc]);

  return (
    <div className="flex flex-col py-2 md:py-6 gap-4 md:gap-8">
      <section className="font-title text-xl md:text-2xl text-center hidden md:block">
        Deep Sea Stories
      </section>

      <section className="w-full flex-none grid grid-cols-2 md:flex md:flex-col gap-4">
        <Button
          size="large"
          className="col-span-2 md:w-full text-sm md:text-base"
          onClick={() => setIsStoryPanelOpen(true)}
        >
          Choose a story
        </Button>

        <HowToPlay className="w-full" />
        <HowItWorks className="w-full" />
        <CopyButton
          variant="outline"
          className="col-span-2 md:col-span-1 text-sm md:text-base"
          onCopy={() => toast("Gameroom link copied to clipboard", Check)}
          value={url}
        >
          Copy room link
        </CopyButton>
      </section>

      <StorySelectionPanel
        isOpen={isStoryPanelOpen}
        onClose={() => setIsStoryPanelOpen(false)}
        roomId={roomId}
      />
    </div>
  );
};

export default RoomControls;
