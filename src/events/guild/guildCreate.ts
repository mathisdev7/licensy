import colors from "colors";
import { Events } from "discord.js";
import { deployCommands } from "../../misc/util.js";
import { Event } from "../../structures/event.js";
global.colors = colors;

export default {
  name: Events.GuildCreate,
  once: true,
  async execute(guild) {
    try {
      console.log("Guild created:".green, guild.name);
      await deployCommands(guild.id);
      const owner = await guild.fetchOwner();
      owner.send({
        content: `Hello! I'm Licensy, a bot that helps you manage your license keys. To get started, type /help in your server.\nDon't forget to join the support server: https://discord.gg/MfEgZ4Vwfe`,
      });
    } catch (error) {
      console.error(error);
    }
  },
} satisfies Event<Events.GuildCreate>;
