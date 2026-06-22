import { cn } from "@/utils/cn";

type Props = {
  className?: string;
};

// The Gemini wordmark sits a touch low in its viewBox, so a small upward nudge
// (-translate-y-2) keeps it baseline-aligned with the Fishjam mark.
export const BrandHeader = ({ className }: Props) => (
  <div
    className={cn("flex flex-col items-center justify-center gap-2", className)}
  >
    <div className="flex items-center justify-center gap-4">
      <a
        href="https://fishjam.swmansion.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src="/fishjam-logo.svg" alt="Fishjam" className="h-12 w-auto" />
      </a>
      <span className="text-3xl font-light text-stone-600 select-none">×</span>
      <img
        src="/gemini-logo.svg"
        alt="Gemini"
        className="h-12 w-auto -translate-y-2"
      />
    </div>
    <p className="max-w-md text-center text-sm text-stone-600">
      Live streaming with real-time AI translation — powered by Fishjam, Gemini,
      and Media over QUIC.
    </p>
  </div>
);
