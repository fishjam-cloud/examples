import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getRandomStory, getInstructionsForStory } from '../src/utils.js';
import type { Story } from '../src/types.js';

describe('Stories Service', () => {
	test('getRandomStory should return a valid Story object', () => {
		const story = getRandomStory();

		assert.strictEqual(typeof story, 'object');
		assert(story !== null, 'Story should not be null');

		assert(
			typeof story.front === 'string',
			'Story should have a front property of type string',
		);
		assert(
			typeof story.back === 'string',
			'Story should have a back property of type string',
		);

		assert(story.front.length > 0, 'Story front should not be empty');
		assert(story.back.length > 0, 'Story back should not be empty');
	});

	test('getInstructionsForStory should replace template placeholders', () => {
		const testStory: Story = {
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
