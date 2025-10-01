import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { z } from 'zod';
import { publicProcedure } from '../trpc.js';

const createPeerInputSchema = z.object({
  roomId: z.string(),
  displayName: z.string().optional(),
});

export const createPeer = publicProcedure
  .input(createPeerInputSchema)
  .mutation(async ({ ctx, input }) => {
    const peer = await ctx.fishjam.createPeer(input.roomId as RoomId, {
      enableSimulcast: true,
    });

    return {
      peer: peer.peer,
      token: peer.peerToken,
    };
  });
