import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';

const PROMO_CODE = 'DeepSea25';
const PROMO_URL = 'https://fishjam.swmansion.com/?utm_source=deep-sea-stories';
const DISMISS_STORAGE_KEY = 'promo-widget-dismissed';
const PROMO_HIDE_AFTER = new Date('2026-03-19T00:00:00Z');

const PROMO_DISMISSED_EVENT = 'promo_dismissed';
const PROMO_CODE_DISPLAYED_EVENT = 'promo_code_displayed';
const PROMO_CODE_COPIED_EVENT = 'promo_code_copied';

const readDismissedFromStorage = () => {
	if (typeof window === 'undefined') return false;
	return window.localStorage.getItem(DISMISS_STORAGE_KEY) === 'true';
};

const isExpired = Date.now() >= PROMO_HIDE_AFTER.getTime();

const sendGAEvent = (event: string) => {
	if (typeof window === 'undefined') return;
	if (typeof window.gtag !== 'function') {
		console.warn('gtag not defined');
		return;
	}

	try {
		window.gtag('event', event, {});
	} catch (e) {
		console.error(`Failed to send ${event} event`, e);
	}
};

const PromoWidget = () => {
	const [promoVisible, setPromoVisible] = useState(false);
	const [dismissed, setDismissed] = useState(readDismissedFromStorage);
	const [copied, setCopied] = useState(false);

	const copyResetRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (copyResetRef.current) {
				window.clearTimeout(copyResetRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (dismissed) {
			window.localStorage.setItem(DISMISS_STORAGE_KEY, 'true');
		}
	}, [dismissed]);

	const triggerCopiedFeedback = () => {
		setCopied(true);
		if (copyResetRef.current) {
			window.clearTimeout(copyResetRef.current);
		}
		copyResetRef.current = window.setTimeout(() => setCopied(false), 2000);
	};

	const fallbackCopy = () => {
		if (typeof document === 'undefined') return;
		const textarea = document.createElement('textarea');
		textarea.value = PROMO_CODE;
		textarea.style.position = 'fixed';
		textarea.style.opacity = '0';
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();
		document.execCommand('copy');
		document.body.removeChild(textarea);
		triggerCopiedFeedback();
	};

	const handleGetPromo = () => {
		sendGAEvent(PROMO_CODE_DISPLAYED_EVENT);
		setPromoVisible(true);
	};

	const handleCopy = async () => {
		try {
			if (navigator.clipboard?.writeText) {
				sendGAEvent(PROMO_CODE_COPIED_EVENT);
				await navigator.clipboard.writeText(PROMO_CODE);
				triggerCopiedFeedback();
				return;
			}
		} catch (error) {
			console.warn('Failed to copy using clipboard API, falling back.', error);
		}

		fallbackCopy();
	};

	const handleDismiss = () => {
		sendGAEvent(PROMO_DISMISSED_EVENT);
		setDismissed(true);
	};

	if (dismissed || isExpired) {
		return null;
	}

	return (
		<div className="pointer-events-auto text-primary">
			<div className="relative w-[min(22rem,_calc(100vw-2rem))] rounded-4xl shadow-amber-100/15 border border-border/80 bg-background/90 p-6 shadow-xl backdrop-blur-2xl">
				<button
					type="button"
					aria-label="Dismiss promo"
					onClick={handleDismiss}
					className="absolute right-3 top-4 rounded-full bg-background/70 px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-primary/60 transition hover:text-primary"
				>
					I'm not interested
				</button>

				<div className="flex flex-col gap-5 text-sm text-primary/80">
					<div>
						<p className="font-display text-[0.55rem] uppercase tracking-[0.6em] text-primary/60">
							Powered by
						</p>
						<a
							className="font-display text-2xl text-primary underline"
							target="_blank"
							rel="noopener"
							href={PROMO_URL}
						>
							Fishjam
						</a>
						<p className="mt-2">
							The realtime infrastructure behind Deep Sea Stories.
							<br />
							Build AI-first audio and video experiences without touching WebRTC
							internals.
						</p>
					</div>

					<div>
						<p className="mt-1">
							Save 25% on your first three months of Regular Jar plan.
						</p>
					</div>

					{promoVisible ? (
						<div className="rounded-3xl border border-border/60 bg-background/80 p-4">
							<div className="flex items-center justify-between text-[0.65rem] font-display uppercase tracking-[0.4em] text-primary/60">
								<span>Promo code</span>
							</div>
							<div className="mt-3 flex flex-wrap justify-between items-center gap-3">
								<span className="font-mono text-lg tracking-[0.4em]">
									{PROMO_CODE}
								</span>
								<Button
									type="button"
									variant="outline"
									className="h-10 px-4 text-[0.6rem] font-semibold uppercase tracking-[0.3em]"
									onClick={handleCopy}
								>
									{copied ? 'Copied' : 'Copy'}
								</Button>
							</div>
						</div>
					) : (
						<Button
							type="button"
							onClick={handleGetPromo}
							className="h-11 w-full text-sm font-display"
						>
							Get a promo code
						</Button>
					)}
					<a
						href={PROMO_URL}
						target="_blank"
						rel="noopener"
						className="mt-1 text-center text-[0.75rem] font-semibold tracking-[0.1em] text-primary/70 underline-offset-4 transition-colors hover:text-primary hover:underline"
					>
						Redeem at fishjam.swmansion.com
					</a>
				</div>
			</div>
		</div>
	);
};

export default PromoWidget;
