import nunjucks from 'nunjucks';
import {
	AGENT_INSTRUCTIONS_TEMPLATE,
	MASTER_AGENT_INSTRUTIONS_TEMPLATE,
} from './config.js';
import type { Story } from './types.js';

export function getMasterInstructionsForStory(story: Story): string {
	return nunjucks.renderString(MASTER_AGENT_INSTRUTIONS_TEMPLATE, {
		FRONT: story.front,
		BACK: story.back,
	});
}

export function getInstructionsForStory(story: Story): string {
	return nunjucks.renderString(AGENT_INSTRUCTIONS_TEMPLATE, {
		FRONT: story.front,
		BACK: story.back,
	});
}
