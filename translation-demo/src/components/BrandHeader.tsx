import { cn } from '@/utils/cn';

type Props = {
  className?: string;
};

// Fishjam x Gemini lockup, shown centered at the top of every stream view. Both logos
// render at the same height; the Gemini wordmark sits a touch low in its viewBox, so a
// small upward nudge keeps it baseline-aligned with the Fishjam mark. A short tagline
// sits underneath to explain what the demo does.
export const BrandHeader = ({ className }: Props) => (
  <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
    <div className="flex items-center justify-center gap-4">
      <a href="https://fishjam.swmansion.com" target="_blank" rel="noopener noreferrer">
        <img src="/fishjam-logo.svg" alt="Fishjam" className="h-12 w-auto" />
      </a>
      <span className="text-3xl font-light text-stone-600 select-none">×</span>
      <img src="/gemini-logo.svg" alt="Gemini" className="h-12 w-auto -translate-y-2" />
    </div>
    <p className="max-w-md text-center text-sm text-stone-600">
      Live streaming with real-time AI translation — powered by Fishjam, Gemini, and Media over QUIC.
    </p>
  </div>
);
