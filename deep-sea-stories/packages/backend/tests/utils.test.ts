import assert from 'node:assert';
import { describe, test } from 'node:test';
import type { Story } from '../src/types.js';
import { getInstructionsForStory } from '../src/utils.js';

describe('Stories Service', () => {
	test('getInstructionsForStory should replace template placeholders', () => {
		const testStory: Story = {
			id: 999,
			title: 'Test Story',
			front: 'Test front story',
			back: 'Test back story',
		};

		const instructions = getInstructionsForStory(testStory);

		assert(
			!instructions.includes('{{FRONT}}'),
			'Should replace {{FRONT}} placeholder',
		);
		assert(
			!instructions.includes('{{BACK}}'),
			'Should replace {{BACK}} placeholder',
		);

		assert(
			instructions.includes(testStory.front),
			'Should include front story content',
		);
		assert(
			instructions.includes(testStory.back),
			'Should include back story content',
		);

		assert(typeof instructions === 'string', 'Should return a string');
		assert(instructions.length > 0, 'Should return non-empty instructions');
	});
});
