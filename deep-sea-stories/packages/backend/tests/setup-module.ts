import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function globalSetup() {
	dotenv.config({
		path: join(__dirname, '.env.test'),
		override: true,
	});
}
