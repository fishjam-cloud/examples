import { AGENT_INSTRUCTIONS_TEMPLATE } from './config.js';
import type { Story } from './types.js';

export function getInstructionsForStory(story: Story): string {
	return AGENT_INSTRUCTIONS_TEMPLATE.replace('{{FRONT}}', story.front).replace(
		'{{BACK}}',
		story.back,
	);
}
