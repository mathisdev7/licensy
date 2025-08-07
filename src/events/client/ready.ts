import colors from "colors";
import { ActivityType, Events } from "discord.js";
global.colors = colors;

import {
	deployCommands,
	manageExpiringOnReady,
	managePremiumOnReady,
} from "../../misc/util.js";
import type { Event } from "../../structures/event.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(
      `[CLIENT_READY] -` + ` ${client.user.username} is online`.bgBlack.blue
    );
    try {
      await deployCommands();
      setInterval(() => {
        client.user.setActivity(`Licensy - /help`, {
          type: ActivityType.Watching,
        });
      }, 15000);
      manageExpiringOnReady(client);
      managePremiumOnReady(client);
    } catch (error) {
      console.error(error);
    }
  },
} satisfies Event<Events.ClientReady>;
