import nunjucks from 'nunjucks';
import {
	FIRST_MESSAGE_TEMPLATE,
	AGENT_INSTRUCTIONS_TEMPLATE,
	AGENT_CLIENT_TOOL_INSTRUCTIONS,
} from './config.js';
import { GAME_TIME_LIMIT_MINUTES } from '@deep-sea-stories/common';
import type { Story } from './types.js';

export function getInstructionsForStory(story: Story): string {
	return nunjucks.renderString(AGENT_INSTRUCTIONS_TEMPLATE, {
		FRONT: story.front,
		BACK: story.back,
		TIME_LIMIT: GAME_TIME_LIMIT_MINUTES,
	});
}

export function getToolDescriptionForStory(story: Story): string {
	return nunjucks.renderString(AGENT_CLIENT_TOOL_INSTRUCTIONS, {
		BACK: story.back,
	});
}

export function getFirstMessageForStory(story: Story): string {
	return nunjucks.renderString(FIRST_MESSAGE_TEMPLATE, {
		FRONT: story.front,
		TIME_LIMIT: GAME_TIME_LIMIT_MINUTES,
	});
}
