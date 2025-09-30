import z from 'zod';

export const peerSchema = z.object({
	id: z.string(),
});

export const roomSchema = z.object({
	id: z.string(),
	peers: peerSchema.array(),
});
