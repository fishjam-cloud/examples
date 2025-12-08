import { GAME_TIME_LIMIT_MINUTES } from '@deep-sea-stories/common';
import nunjucks from 'nunjucks';
import {
	AGENT_CLIENT_TOOL_INSTRUCTIONS,
	AGENT_INSTRUCTIONS_TEMPLATE,
	FIRST_MESSAGE_TEMPLATE,
} from './config.js';
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
