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

import pkg from "lodash";
import type { Command } from "../../structures/command.js";
import { licenseData } from "../../types/licenseData.js";
const { chunk } = pkg;

export default {
  data: {
    name: "license-list",
    description: "Show the licenses unredeemed yet.",
    options: [
      {
        name: "role",
        description: "Filter licenses by role to grant.",
        type: ApplicationCommandOptionType.Role,
        required: false,
      },
      {
        name: "author",
        description: "Filter licenses by the creator.",
        type: ApplicationCommandOptionType.User,
        required: false,
      },
      {
        name: "sort",
        description: "Sort order for the licenses.",
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          {
            name: "Expiration ascending",
            value: "expiration_asc",
          },
          {
            name: "Expiration descending",
            value: "expiration_desc",
          },
        ],
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
      const filterRole = interaction.options.getRole("role");
      const filterAuthor = interaction.options.getUser("author");
      const sortOption = interaction.options.getString("sort");

      const orderBy =
        sortOption === "expiration_desc"
          ? { validUntil: "desc" as const }
          : sortOption === "expiration_asc"
          ? { validUntil: "asc" as const }
          : { createdAt: "desc" as const };

      const licenses = await prisma.license.findMany({
        where: {
          guildId: interaction.guild.id,
          activated: false,
          ...(filterRole ? { role: filterRole.id } : {}),
          ...(filterAuthor ? { author: filterAuthor.id } : {}),
        },
        orderBy,
      });

      if (!licenses.length) {
        await interaction.reply({
          content:
            filterRole || filterAuthor
              ? "No licenses match the provided filters."
              : "There are no licenses available.",
          flags: MessageFlags.Ephemeral,
        });
        prisma.$disconnect();
        return;
      }

      const buttonRightArrow = new ButtonBuilder()
        .setCustomId("right-arrow")
        .setLabel(">")
        .setStyle(ButtonStyle.Secondary);

      const buttonLeftArrow = new ButtonBuilder()
        .setCustomId("left-arrow")
        .setLabel("<")
        .setStyle(ButtonStyle.Secondary);

      const interactionReplied = await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      let keysSliced: licenseData[][] = [];
      const fetchingKeys = new Promise((resolve) => {
        keysSliced = chunk(licenses, 5);
        setTimeout(resolve, licenses.length * 40);
      });
      await fetchingKeys;
      let currentPage = 0;
      const button = new ButtonBuilder()
        .setCustomId(
          `get-license-key-${keysSliced[currentPage]
            .map((license) => license.key)
            .join("-")}`
        )
        .setLabel(`Copy License Key${licenses.length > 1 ? "s" : ""}`)
        .setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        button,
        buttonLeftArrow,
        buttonRightArrow
      );
      const embed = new EmbedBuilder()
        .setTitle("Unredeemed Licenses")
        .setDescription(
          licenses.length > 0
            ? `The licenses that have not been redeemed yet are:\n\n${keysSliced[
                currentPage
              ]
                .map((license: licenseData) => `- \`${license.key}\``)
                .join("\n")}`
            : "There are no licenses available."
        )
        .setColor("#2f3135")
        .setTimestamp()
        .setFooter({
          text: `Licensy - Page ${currentPage + 1}/${keysSliced.length}`,
        });

      interactionReplied.edit({
        embeds: [embed],
        components: licenses.length > 0 ? [row] : [],
      });

      const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 350000,
      });
      collector.on("collect", async (buttonInteraction) => {
        if (buttonInteraction.customId === "right-arrow") {
          currentPage += 1;
          if (currentPage >= keysSliced.length) {
            currentPage = 0;
          }
          const newButton = new ButtonBuilder()
            .setCustomId(
              `get-license-key-${keysSliced[currentPage]
                .map((license) => license.key)
                .join("-")}`
            )
            .setLabel(`Copy License Key${licenses.length > 1 ? "s" : ""}`)
            .setStyle(ButtonStyle.Primary);
          const newEmbed = new EmbedBuilder()
            .setTitle("Unredeemed Licenses")
            .setDescription(
              licenses.length > 0
                ? `The licenses that have not been redeemed yet are:\n\n${keysSliced[
                    currentPage
                  ]
                    .map((license: licenseData) => `- \`${license.key}\``)
                    .join("\n")}`
                : "There are no licenses available."
            )
            .setColor("#2f3135")
            .setTimestamp()
            .setFooter({
              text: `Licensy - Page ${currentPage + 1}/${keysSliced.length}`,
            });
          buttonInteraction.update({
            embeds: [newEmbed],
            components: [
              row.setComponents([newButton, buttonLeftArrow, buttonRightArrow]),
            ],
          });
        } else if (buttonInteraction.customId === "left-arrow") {
          currentPage -= 1;
          if (currentPage < 0) {
            currentPage = keysSliced.length - 1;
          }
          const newButton = new ButtonBuilder()
            .setCustomId(
              `get-license-key-${keysSliced[currentPage]
                .map((license) => license.key)
                .join("-")}`
            )
            .setLabel(`Copy License Key${licenses.length > 1 ? "s" : ""}`)
            .setStyle(ButtonStyle.Primary);
          const newEmbed = new EmbedBuilder()
            .setTitle("Unredeemed Licenses")
            .setDescription(
              licenses.length > 0
                ? `The licenses that have not been redeemed yet are:\n\n${keysSliced[
                    currentPage
                  ]
                    .map((license: licenseData) => `- \`${license.key}\``)
                    .join("\n")}`
                : "There are no licenses available."
            )
            .setColor("#2f3135")
            .setTimestamp()
            .setFooter({
              text: `Licensy - Page ${currentPage + 1}/${keysSliced.length}`,
            });
          buttonInteraction.update({
            embeds: [newEmbed],
            components: [
              row.setComponents([newButton, buttonLeftArrow, buttonRightArrow]),
            ],
          });
        }
      });
      prisma.$disconnect();
    } catch (error) {
      console.error(error);
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
