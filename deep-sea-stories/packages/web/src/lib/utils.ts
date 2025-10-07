import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const ALPHANUM =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomString(length: number = 10): string {
	let result = '';

	for (let i = 0; i < length; i++) {
		result += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length));
	}

	return result;
}
