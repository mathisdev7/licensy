import { ActivityType, Events } from "discord.js";

import { manageExpiringOnReady, managePremiumOnReady } from "../../misc/util.js";
import type { Event } from "../../structures/event.js";
import type { ExtendedClient } from "../../structures/client.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`[CLIENT_READY] - ${client.user.username} is online`);
    try {
      setInterval(() => {
        client.user.setActivity(`Licensy - /help`, {
          type: ActivityType.Watching,
        });
      }, 15000);
      manageExpiringOnReady(client as ExtendedClient);
      managePremiumOnReady(client as ExtendedClient);
    } catch (error) {
      console.error(error);
    }
  },
} satisfies Event<Events.ClientReady>;
