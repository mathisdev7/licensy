import { Events, MessageFlags } from "discord.js";

import type { Event } from "../../structures/event.js";

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.inCachedGuild()) return;
    if (interaction.customId.startsWith("get-license-key")) {
      if (interaction.customId.split("-")[4]) {
        const keys = interaction.customId.split("-").slice(3);
        interaction.reply({
          content: "I've sent you the license keys in DMs to copy them.",
          flags: MessageFlags.Ephemeral,
        });
        interaction.user.send(keys.join("\n"));
        return;
      }
      const key = interaction.customId.split("-")[3];
      interaction.reply({
        content: "I've sent you the license key in DMs to copy it.",
        flags: MessageFlags.Ephemeral,
      });
      interaction.user.send(`${key}`);
      return;
    }
  },
} satisfies Event<Events.InteractionCreate>;
