import nunjucks from 'nunjucks';
import {
	AGENT_INSTRUCTIONS_TEMPLATE,
	AGENT_CLIENT_TOOL_INSTRUCTIONS,
} from './config.js';
import type { Story } from './types.js';

export function getInstructionsForStory(story: Story): string {
	return nunjucks.renderString(AGENT_INSTRUCTIONS_TEMPLATE, {
		FRONT: story.front,
		BACK: story.back,
	});
}

export function getToolDescriptionForStory(story: Story): string {
	return AGENT_CLIENT_TOOL_INSTRUCTIONS.replace('{{ BACK }}', story.back);
}
