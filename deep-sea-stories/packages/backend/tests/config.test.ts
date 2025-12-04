import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
	AGENT_INSTRUCTIONS_TEMPLATE,
	configSchema,
	stories,
} from '../src/config.js';

describe('Configuration', () => {
	test('stories should be loaded and be a valid array', () => {
		assert(Array.isArray(stories), 'Stories should be an array');
		assert(stories.length > 0, 'Stories array should not be empty');
	});

	test('each story should have valid front and back properties', () => {
		stories.forEach((story, index) => {
			assert(typeof story === 'object', `Story ${index} should be an object`);
			assert(story !== null, `Story ${index} should not be null`);

			assert(
				typeof story.front === 'string',
				`Story ${index} should have a front property of type string`,
			);
			assert(
				typeof story.back === 'string',
				`Story ${index} should have a back property of type string`,
			);

			assert(
				story.front.length > 0,
				`Story ${index} front should not be empty`,
			);
			assert(story.back.length > 0, `Story ${index} back should not be empty`);
		});
	});

	test('AGENT_INSTRUCTIONS_TEMPLATE should be loaded and contain placeholders', () => {
		assert(
			typeof AGENT_INSTRUCTIONS_TEMPLATE === 'string',
			'Instructions template should be a string',
		);
		assert(
			AGENT_INSTRUCTIONS_TEMPLATE.length > 0,
			'Instructions template should not be empty',
		);

		assert(
			AGENT_INSTRUCTIONS_TEMPLATE.includes('{{ FRONT }}'),
			'Template should contain {{ FRONT }} placeholder',
		);
		assert(
			AGENT_INSTRUCTIONS_TEMPLATE.includes('{{ BACK }}'),
			'Template should contain {{ BACK }} placeholder',
		);
	});

	test('configSchema should validate required environment variables', () => {
		assert.throws(() => {
			configSchema.parse({});
		}, 'Should throw when required FISHJAM_ID is missing');

		assert.throws(() => {
			configSchema.parse({
				FISHJAM_ID: 'test-id',
			});
		}, 'Should throw when required FISHJAM_MANAGEMENT_TOKEN is missing');

		assert.throws(() => {
			configSchema.parse({
				FISHJAM_ID: 'test-id',
				FISHJAM_MANAGEMENT_TOKEN: 'test-token',
				GEMINI_API_KEY: 'test-gemini-key',
			});
		}, 'Should throw when required ELEVENLABS_API_KEY is missing');

		assert.doesNotThrow(() => {
			configSchema.parse({
				FISHJAM_ID: 'test-id',
				FISHJAM_MANAGEMENT_TOKEN: 'test-token',
				ELEVENLABS_API_KEY: 'test-api-key',
				GEMINI_API_KEY: 'test-gemini-key',
			});
		}, 'Should not throw with all required fields');
	});

	test('configSchema should provide default PORT value', () => {
		const config = configSchema.parse({
			FISHJAM_ID: 'test-id',
			FISHJAM_MANAGEMENT_TOKEN: 'test-token',
			ELEVENLABS_API_KEY: 'test-api-key',
			GEMINI_API_KEY: 'test-gemini-key',
		});

		assert.strictEqual(config.PORT, 8000, 'Should default PORT to 8000');
	});

	test('configSchema should accept custom PORT value', () => {
		const config = configSchema.parse({
			FISHJAM_ID: 'test-id',
			FISHJAM_MANAGEMENT_TOKEN: 'test-token',
			ELEVENLABS_API_KEY: 'test-api-key',
			GEMINI_API_KEY: 'test-gemini-key',
			PORT: '3000',
		});

		assert.strictEqual(
			config.PORT,
			3000,
			'Should accept and convert custom PORT value',
		);
	});
});
