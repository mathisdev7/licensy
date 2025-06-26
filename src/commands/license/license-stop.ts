import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-stop",
    description: "Stop an active license key.",
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
          activated: true,
        },
      });
      if (!license) {
        prisma.$disconnect();
        interaction.reply({
          content:
            "The license key provided does not exist or is not redeemed.",
          ephemeral: true,
        });
        return;
      }
      const member = await interaction.guild.members.fetch(license.redeemer);
      if (!member) {
        prisma.$disconnect();
        interaction.reply({
          content: "The member who redeemed the license is not in the guild.",
          ephemeral: true,
        });
        return;
      }
      await member.roles.remove(license.role);
      await prisma.license.delete({
        where: {
          key: license.key,
          guildId: interaction.guild.id,
        },
      });
      interaction.client.emit(
        "licenseStopped",
        interaction.client,
        license,
        interaction.guild,
        member,
        interaction.member,
        interaction.locale
      );
      interaction.reply({
        content:
          "The license key has been deleted and the role of the member has been removed.",
        ephemeral: true,
      });
      prisma.$disconnect();
    } catch (error) {
      console.error(`Failed to delete license: ${error.message}`);
    }
  },
} satisfies Command;
