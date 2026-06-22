import { Button } from "@/components/ui/button";

type Props = {
  onDisconnect: () => void;
};

export const StreamToolbar = ({ onDisconnect }: Props) => {
  return (
    <footer className="flex py-8 flex-wrap items-center justify-center gap-8 mx-8">
      <Button
        className="rounded-lg text-xs !bg-[#DD6460] hover:!bg-[#DD6460]/90"
        variant="destructive"
        onClick={onDisconnect}
      >
        Disconnect
      </Button>
    </footer>
  );
};
