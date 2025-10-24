import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";
import ms from "ms";

import type { Command } from "../../structures/command.js";

const MAX_LIST_ENTRIES = 25;

function formatExpiry(expiresAt?: Date | null, locale?: string | null) {
  if (!expiresAt) return "Never";
  return new Intl.DateTimeFormat(locale ?? undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(expiresAt);
}

export default {
  data: {
    name: "license-ban",
    description: "Manage users banned from license actions.",
    options: [
      {
        name: "add",
        description: "Ban a user from creating or redeeming licenses.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "user",
            description: "The user to ban.",
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: "duration",
            description: "How long the ban should last (e.g. 7d, 12h).",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "reason",
            description: "Reason for the ban.",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "remove",
        description: "Remove a user from the ban list.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "user",
            description: "The user to unban.",
            type: ApplicationCommandOptionType.User,
            required: true,
          },
        ],
      },
      {
        name: "list",
        description: "List banned users.",
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
      const guildId = interaction.guild.id;
      const sub = interaction.options.getSubcommand();

      if (sub === "add") {
        const user = interaction.options.getUser("user", true);
        const duration = interaction.options.getString("duration") ?? undefined;
        const reason =
          interaction.options.getString("reason")?.trim() || undefined;
        let expiresAt: Date | undefined;

        if (duration) {
          const msResult = ms(duration);
          if (
            typeof msResult !== "number" ||
            Number.isNaN(msResult) ||
            msResult <= 0
          ) {
            prisma.$disconnect();
            await interaction.reply({
              content:
                "Invalid duration provided. Example formats: 7d, 12h, 30m.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          expiresAt = new Date(Date.now() + msResult);
        }

        const existing = await prisma.licenseBan.findFirst({
          where: { guildId, userId: user.id },
        });

        if (existing) {
          if (existing.expiresAt && existing.expiresAt <= new Date()) {
            await prisma.licenseBan.delete({ where: { id: existing.id } });
          } else {
            prisma.$disconnect();
            await interaction.reply({
              content: `That user is already banned${
                existing.expiresAt
                  ? ` until ${formatExpiry(
                      existing.expiresAt,
                      interaction.guildLocale
                    )}`
                  : ""
              }.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }

        await prisma.licenseBan.create({
          data: {
            guildId,
            userId: user.id,
            reason,
            expiresAt,
          },
        });

        prisma.$disconnect();

        await interaction.reply({
          content: `Banned ${user} from license actions${
            expiresAt
              ? ` until ${formatExpiry(expiresAt, interaction.guildLocale)}`
              : ""
          }${reason ? `\nReason: ${reason}` : ""}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (sub === "remove") {
        const user = interaction.options.getUser("user", true);
        const existing = await prisma.licenseBan.findFirst({
          where: { guildId, userId: user.id },
        });

        if (!existing) {
          prisma.$disconnect();
          await interaction.reply({
            content: `${user} is not currently banned.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await prisma.licenseBan.delete({ where: { id: existing.id } });

        prisma.$disconnect();

        await interaction.reply({
          content: `Removed ${user} from the license ban list.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (sub === "list") {
        const now = new Date();
        const bans = await prisma.licenseBan.findMany({
          where: { guildId },
          orderBy: { createdAt: "desc" },
        });

        const activeBans = bans.filter(
          (ban) => !ban.expiresAt || ban.expiresAt > now
        );
        const expiredBans = bans.filter(
          (ban) => ban.expiresAt && ban.expiresAt <= now
        );

        for (const ban of expiredBans) {
          await prisma.licenseBan.delete({ where: { id: ban.id } });
        }

        prisma.$disconnect();

        if (!activeBans.length) {
          await interaction.reply({
            content: "No active license bans.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("Active License Bans")
          .setColor("#2f3135")
          .setTimestamp();

        const lines = activeBans.slice(0, MAX_LIST_ENTRIES).map((ban) => {
          const reason = ban.reason ? ` | Reason: ${ban.reason}` : "";
          return `• <@${ban.userId}> (until ${formatExpiry(
            ban.expiresAt,
            interaction.guildLocale
          )})${reason}`;
        });

        embed.setDescription(lines.join("\n"));

        if (activeBans.length > MAX_LIST_ENTRIES) {
          embed.setFooter({
            text: `Showing ${MAX_LIST_ENTRIES} of ${activeBans.length} active bans.`,
          });
        }

        await interaction.reply({
          embeds: [embed],
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
