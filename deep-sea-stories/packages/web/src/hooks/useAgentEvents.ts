import type { AgentEvent } from "@deep-sea-stories/common";
import { useEffect, useState } from "react";
import { useTRPCClient } from "@/contexts/trpc";

export const useAgentEvents = (roomId?: string) => {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const trpcClient = useTRPCClient();

  useEffect(() => {
    if (!roomId) return;

    setEvents([]);

    let subscription:
      | ReturnType<typeof trpcClient.Notifications.subscribe>
      | undefined;
    let active = true;

    trpcClient.getEvents
      .query({ roomId })
      .then(({ events: pastEvents, lastEventId }) => {
        if (!active) return;

        setEvents(pastEvents);

        subscription = trpcClient.Notifications.subscribe(
          { roomId, lastEventId },
          {
            onData: (data: unknown) => {
              const event =
                data && typeof data === "object" && "data" in data
                  ? (data as { data: AgentEvent }).data
                  : (data as AgentEvent);
              setEvents((prev) => [...prev, event]);
            },
            onError: (error: unknown) => {
              console.error("[useAgentEvents] Subscription error:", error);
            },
          },
        );
      });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [trpcClient, roomId]);

  return events;
};
