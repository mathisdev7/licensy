import { ActivityType, Events } from "discord.js";

import {
  manageExpiringOnReady,
  managePremiumOnReady,
} from "../../misc/util.js";
import type { ExtendedClient } from "../../structures/client.js";
import type { Event } from "../../structures/event.js";

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
      const commands = Array.from(client.commands.values())
        .filter((cmd) => cmd.data.name)
        .map((cmd) => ({
          name: cmd.data.name,
          description:
            // @ts-expect-error description do exist
            cmd.data.description || "No description",
          options: cmd.data.options || [],
          dm_permission: false,
          type: 1,
          integration_types: [0, 1],
          contexts: [0, 1, 2],
        }));

      await client.application?.commands.set(commands);
    } catch (error) {
      console.error(error);
    }
  },
} satisfies Event<Events.ClientReady>;
