import {
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-role-sync",
    description:
      "Ensure members with active licenses have the correct role assigned.",
    options: [],
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
      const interactionReply = await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const activeLicenses = await prisma.license.findMany({
        where: {
          guildId: interaction.guild.id,
          activated: true,
        },
      });

      if (!activeLicenses.length) {
        prisma.$disconnect();
        await interactionReply.edit({
          content: "There are no active licenses to synchronize.",
        });
        return;
      }

      const { safeFetchMember } = await import("../../misc/util.js");

      const me = interaction.guild.members.me;
      if (!me) {
        prisma.$disconnect();
        await interactionReply.edit({
          content:
            "Unable to resolve the bot's member instance to manage roles.",
        });
        return;
      }

      const canManageRoles = me.permissions.has(
        PermissionsBitField.Flags.ManageRoles
      );

      const restoredRoles: string[] = [];
      const alreadySynced: string[] = [];
      const missingMembers: string[] = [];
      const orphanLicenses: string[] = [];
      const missingRoles: string[] = [];
      const unmanageableRoles: string[] = [];
      const roleSyncErrors: string[] = [];

      for (const license of activeLicenses) {
        if (!license.redeemer) {
          orphanLicenses.push(`• \`${license.key}\` (no redeemer recorded)`);
          continue;
        }

        const member = await safeFetchMember(
          interaction.guild,
          license.redeemer
        );
        if (!member) {
          missingMembers.push(
            `• \`${license.key}\` (redeemer <@${license.redeemer}> left the guild)`
          );
          continue;
        }

        const role =
          interaction.guild.roles.cache.get(license.role) ??
          (await interaction.guild.roles.fetch(license.role).catch(() => null));
        if (!role) {
          missingRoles.push(
            `• \`${license.key}\` (role ${license.role} missing)`
          );
          continue;
        }

        if (!canManageRoles) {
          unmanageableRoles.push(
            `• \`${license.key}\` (missing Manage Roles permission to sync ${role})`
          );
          continue;
        }

        if (me.roles.highest.comparePositionTo(role) <= 0) {
          unmanageableRoles.push(
            `• \`${license.key}\` (<@${member.id}> -> ${role} higher than bot)`
          );
          continue;
        }

        if (member.roles.cache.has(role.id)) {
          alreadySynced.push(
            `• ${role} already on <@${member.id}> (\`${license.key}\`)`
          );
          continue;
        }

        try {
          await member.roles.add(role, "License role sync");
          restoredRoles.push(
            `• Added ${role} to <@${member.id}> (\`${license.key}\`)`
          );
        } catch (error) {
          roleSyncErrors.push(
            `• Failed to add ${role} to <@${member.id}> (\`${license.key}\`): ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      const formatList = (title: string, items: string[]) =>
        items.length
          ? {
              name: title,
              value:
                items
                  .map((line) => line.trim())
                  .slice(0, 10)
                  .join("\n") + (items.length > 10 ? "\n…" : ""),
              inline: false,
            }
          : null;

      const embed = new EmbedBuilder()
        .setTitle("License Role Sync Summary")
        .setDescription(
          `Checked ${activeLicenses.length} active license${
            activeLicenses.length === 1 ? "" : "s"
          }.`
        )
        .setColor("#2f3135")
        .setTimestamp();

      const fields = [
        formatList("Roles Restored", restoredRoles),
        formatList("Already In Sync", alreadySynced),
        formatList("Missing Members", missingMembers),
        formatList("Missing Roles", missingRoles),
        formatList("Unmanageable Roles", unmanageableRoles),
        formatList("Orphan Licenses", orphanLicenses),
        formatList("Role Assignment Errors", roleSyncErrors),
      ].filter(
        (field): field is { name: string; value: string; inline: boolean } =>
          Boolean(field)
      );

      if (!fields.length) {
        embed.addFields({
          name: "Status",
          value: "All active licenses are synchronized.",
        });
      } else {
        embed.addFields(fields);
      }

      prisma.$disconnect();

      await interactionReply.edit({
        content: "",
        embeds: [embed],
      });
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
