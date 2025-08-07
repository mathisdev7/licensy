import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-delete",
    description: "Delete a license key.",
    options: [
      {
        name: "license",
        description: "The license key to delete.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  opt: {
    userPermissions: ["Administrator"],
    botPermissions: ["SendMessages"],
    category: "License",
    cooldown: 5,
  },
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    try {
      const prisma = interaction.client.prisma;
      const license = await prisma.license.findFirst({
        where: {
          guildId: interaction.guild.id,
          key: interaction.options.getString("license"),
          activated: false,
        },
      });
      if (!license) {
        prisma.$disconnect();
        interaction.reply({
          content: "The license key provided does not exist.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await prisma.license.delete({
        where: {
          key: license.key,
          guildId: interaction.guild.id,
        },
      });
      interaction.reply({
        content: "The license key has been deleted.",
        flags: MessageFlags.Ephemeral,
      });
      prisma.$disconnect();
    } catch (error) {
      console.error(`Failed to delete license: ${error.message}`);
    }
  },
} satisfies Command;
