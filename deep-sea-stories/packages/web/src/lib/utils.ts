import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const adjectives = [
	'abyssal',
	'deep',
	'azure',
	'sunken',
	'coral',
	'oceanic',
	'tidal',
	'bioluminescent',
	'mysterious',
	'ancient',
	'dark',
	'glowing',
];

const nouns = [
	'trench',
	'reef',
	'anemone',
	'whale',
	'kraken',
	'octopus',
	'leviathan',
	'shark',
	'jellyfish',
	'nautilus',
	'squid',
	'shipwreck',
	'angler',
];

export function generateDeepSeaSlug(): string {
	const randomAdjective =
		adjectives[Math.floor(Math.random() * adjectives.length)];
	const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

	return `${randomAdjective}-${randomNoun}-${Math.floor(Math.random() * 100)}`;
}
