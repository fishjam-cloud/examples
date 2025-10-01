import z from 'zod';

export const getRoomInputSchema = z.object({ roomId: z.string() });

