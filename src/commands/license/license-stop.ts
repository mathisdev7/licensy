import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../structures/command.js";
import type { ExtendedClient } from "../../structures/client.js";

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
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const { safeFetchMember, safeRemoveRole } = await import("../../misc/util.js");
      const member = await safeFetchMember(interaction.guild, license.redeemer);
      if (!member) {
        await prisma.license.delete({
          where: {
            key: license.key,
            guildId: interaction.guild.id,
          },
        });
        prisma.$disconnect();
        interaction.reply({
          content: "The member who redeemed the license is no longer in the guild. License has been deleted.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await safeRemoveRole(member, license.role);

      await prisma.license.delete({
        where: {
          key: license.key,
          guildId: interaction.guild.id,
        },
      });
      interaction.client.emit(
        "licenseStopped",
        interaction.client as ExtendedClient,
        license,
        interaction.guild,
        member,
        interaction.member,
        interaction.guildLocale
      );
      interaction.reply({
        content:
          "The license key has been deleted and the role of the member has been removed.",
        flags: MessageFlags.Ephemeral,
      });
      prisma.$disconnect();
    } catch (error) {
      console.error(`Failed to delete license: ${error.message}`);
    }
  },
} satisfies Command;
