import colors from "colors";
import { EmbedBuilder, Events } from "discord.js";
import { sendWebhookLog } from "../../misc/util.js";
import { Event } from "../../structures/event.js";
global.colors = colors;

export default {
  name: Events.GuildCreate,
  once: false,
  async execute(guild) {
    try {
      console.log("Guild created:".green, guild.name);

      try {
        const owner = await guild.fetchOwner();
        const embed = new EmbedBuilder()
          .setTitle("🎉 Bot Joined New Guild")
          .setColor(0x57f287)
          .addFields(
            { name: "Guild Name", value: guild.name, inline: true },
            { name: "Guild ID", value: guild.id, inline: true },
            {
              name: "Owner",
              value: `${owner.user.tag} (${owner.id})`,
              inline: false,
            },
            {
              name: "Member Count",
              value: guild.memberCount.toString(),
              inline: true,
            },
            {
              name: "Created At",
              value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
              inline: true,
            }
          )
          .setThumbnail(guild.iconURL() ?? null)
          .setTimestamp();

        await sendWebhookLog("", [embed.toJSON()]);
      } catch (webhookError) {
        console.error(
          "Failed to send guild create log to webhook:",
          webhookError
        );
      }

      const owner = await guild.fetchOwner();
      owner.send({
        content: `Hello! I'm Licensy, a bot that helps you manage your license keys. To get started, type /help in your server.\nDon't forget to join the support server: https://discord.gg/MfEgZ4Vwfe`,
      });
    } catch (error) {
      console.error(error);
    }
  },
} satisfies Event<Events.GuildCreate>;
