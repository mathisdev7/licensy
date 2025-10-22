import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { Command } from "../../structures/command.js";
import pkg from "lodash";

const { chunk } = pkg;

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Created",
  REDEEM: "Redeemed",
  EXPIRE: "Expired",
};

function formatTimestamp(date: Date, locale?: string | null): string {
  const formatter = new Intl.DateTimeFormat(locale ?? undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
  return formatter.format(date);
}

export default {
  data: {
    name: "license-history",
    description: "View recent license activity.",
    options: [
      {
        name: "license",
        description: "Only show history for this license key.",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
      {
        name: "action",
        description: "Filter by action type.",
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: "Created", value: "CREATE" },
          { name: "Redeemed", value: "REDEEM" },
          { name: "Expired", value: "EXPIRE" },
        ],
      },
      {
        name: "actor",
        description: "Filter by the user who performed the action.",
        type: ApplicationCommandOptionType.User,
        required: false,
      },
      {
        name: "target",
        description: "Filter by the target user.",
        type: ApplicationCommandOptionType.User,
        required: false,
      },
      {
        name: "limit",
        description: "How many entries to show (max 25).",
        type: ApplicationCommandOptionType.Integer,
        required: false,
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
      const licenseKey = interaction.options.getString("license") ?? undefined;
      const action = interaction.options.getString("action") ?? undefined;
      const actor = interaction.options.getUser("actor") ?? undefined;
      const target = interaction.options.getUser("target") ?? undefined;
      const limitRaw = interaction.options.getInteger("limit") ?? 10;
      const limit = Math.max(1, Math.min(limitRaw, 25));

      const historyEntries = await prisma.licenseHistory.findMany({
        where: {
          guildId: interaction.guild.id,
          ...(licenseKey ? { licenseKey } : {}),
          ...(action ? { action } : {}),
          ...(actor ? { actorId: actor.id } : {}),
          ...(target ? { targetId: target.id } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      if (!historyEntries.length) {
        prisma.$disconnect();
        await interaction.reply({
          content: "No license history entries found for the requested filters.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const entriesPerPage = 5;
      const historyChunks = chunk(historyEntries, entriesPerPage);
      const hasMultiplePages = historyChunks.length > 1;
      const baseCustomId = `license-history-${interaction.id}`;
      let currentPage = 0;

      const buildDescription = (pageIndex: number) =>
        historyChunks[pageIndex]
          .map((entry, index) => {
            const actionLabel = ACTION_LABELS[entry.action] ?? entry.action;
            const actorMention = entry.actorId ? `<@${entry.actorId}>` : "Unknown";
            const targetMention = entry.targetId
              ? entry.action === "CREATE"
                ? `<@&${entry.targetId}>`
                : `<@${entry.targetId}>`
              : "None";
            const timestamp = formatTimestamp(
              entry.createdAt,
              interaction.guildLocale
            );
            const details = entry.details ? `\nDetails: ${entry.details}` : "";
            const position = pageIndex * entriesPerPage + index + 1;

            return `**${position}. ${actionLabel}** \`${entry.licenseKey}\`
Actor: ${actorMention} | Target: ${targetMention}
When: ${timestamp}${details}`;
          })
          .join("\n\n");

      const buildEmbed = (pageIndex: number) =>
        new EmbedBuilder()
          .setTitle("License History")
          .setDescription(buildDescription(pageIndex))
          .setColor("#2f3135")
          .setTimestamp()
          .setFooter({
            text: `Licensy v3 - Page ${pageIndex + 1}/${historyChunks.length}`,
          });

      const buildRow = () =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`${baseCustomId}-prev`)
            .setLabel("<")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasMultiplePages),
          new ButtonBuilder()
            .setCustomId(`${baseCustomId}-next`)
            .setLabel(">")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasMultiplePages)
        );

      const interactionReply = await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      await interactionReply.edit({
        embeds: [buildEmbed(currentPage)],
        components: hasMultiplePages ? [buildRow()] : [],
      });

      prisma.$disconnect();

      if (!hasMultiplePages) {
        return;
      }

      const collector = interaction.channel?.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 350000,
      });

      collector?.on("collect", async (buttonInteraction) => {
        if (!buttonInteraction.customId.startsWith(baseCustomId)) return;

        if (buttonInteraction.customId === `${baseCustomId}-next`) {
          currentPage = (currentPage + 1) % historyChunks.length;
        }

        if (buttonInteraction.customId === `${baseCustomId}-prev`) {
          currentPage =
            (currentPage - 1 + historyChunks.length) % historyChunks.length;
        }

        await buttonInteraction.update({
          embeds: [buildEmbed(currentPage)],
          components: [buildRow()],
        });
      });
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
