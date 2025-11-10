import nunjucks from 'nunjucks';
import {
	AGENT_INSTRUCTIONS_TEMPLATE,
	FIRST_MESSAGE_TEMPLATE,
} from './config.js';
import type { Story } from './types.js';

export function getInstructionsForStory(story: Story): string {
	return nunjucks.renderString(AGENT_INSTRUCTIONS_TEMPLATE, {
		FRONT: story.front,
		BACK: story.back,
	});
}

export function getFirstMessageForStory(story: Story): string {
	return nunjucks.renderString(FIRST_MESSAGE_TEMPLATE, {
		FRONT: story.front,
	});
}
