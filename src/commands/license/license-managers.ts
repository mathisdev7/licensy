import {
  ApplicationCommandOptionType,
  MessageFlags,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-managers",
    description: "Manage roles allowed to create license keys.",
    options: [
      {
        name: "add",
        description: "Allow a role to create license keys.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "role",
            description: "The role to allow.",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
        ],
      },
      {
        name: "remove",
        description: "Revoke a role's ability to create license keys.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "role",
            description: "The role to revoke.",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
        ],
      },
      {
        name: "list",
        description: "List configured roles allowed to create license keys.",
        type: ApplicationCommandOptionType.Subcommand,
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
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === "add") {
        const role = interaction.options.getRole("role", true);
        const existing = await prisma.licenseManager.findFirst({
          where: { guildId, roleId: role.id },
        });

        if (existing) {
          prisma.$disconnect();
          await interaction.reply({
            content: `The role ${role} is already allowed to create license keys.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await prisma.licenseManager.create({
          data: {
            guildId,
            roleId: role.id,
          },
        });

        prisma.$disconnect();
        await interaction.reply({
          content: `The role ${role} can now create license keys.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === "remove") {
        const role = interaction.options.getRole("role", true);
        const existing = await prisma.licenseManager.findFirst({
          where: { guildId, roleId: role.id },
        });

        if (!existing) {
          prisma.$disconnect();
          await interaction.reply({
            content: `The role ${role} is not configured to create license keys.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await prisma.licenseManager.delete({
          where: { id: existing.id },
        });

        prisma.$disconnect();
        await interaction.reply({
          content: `The role ${role} can no longer create license keys.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === "list") {
        const managers = await prisma.licenseManager.findMany({
          where: { guildId },
        });

        prisma.$disconnect();

        if (!managers.length) {
          await interaction.reply({
            content:
              "Only members with the Administrator permission can create license keys.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const roleMentions = managers
          .map((manager) => `<@&${manager.roleId}>`)
          .join("\n");

        await interaction.reply({
          content: `Roles allowed to create license keys:\n${roleMentions}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      prisma.$disconnect();
      await interaction.reply({
        content: "Unknown subcommand.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
