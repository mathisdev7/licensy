import {
  MessageFlags,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "deploy",
    description: "Deploy the commands to the server.",
  },
  opt: {
    userPermissions: ["Administrator"],
    botPermissions: ["SendMessages"],
    category: "General",
    cooldown: 10,
  },
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    try {
      const commands = Array.from(interaction.client.commands.values())
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

      await interaction.client.application?.commands.set(commands);
      await interaction.reply({
        content: "Commands deployed successfully",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
