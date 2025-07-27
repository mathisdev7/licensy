import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";
import parseMs from "parse-ms-2";

import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-info",
    description: "Show information about an unredeemed license.",
    options: [
      {
        name: "license",
        description: "The license key to get information about.",
        type: 3,
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
          key: interaction.options.getString("license"),
          guildId: interaction.guild.id,
        },
      });
      if (!license) {
        prisma.$disconnect();
        interaction.reply({
          content:
            "The license key provided does not exist or has already been redeemed.",
          ephemeral: true,
        });
        return;
      }
      const licenseCreatedAtToMs = license.createdAt.getTime();
      const licenseTimeToMs = Number(license.validUntil) - licenseCreatedAtToMs;
      const licenseTime = `${parseMs(licenseTimeToMs).days} days, ${
        parseMs(licenseTimeToMs).hours
      } hours, ${parseMs(licenseTimeToMs).minutes} minutes, ${
        parseMs(licenseTimeToMs).seconds
      } seconds`;
      const button = new ButtonBuilder()
        .setCustomId(`get-license-key-${license.key}`)
        .setLabel("Copy License Key")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<any>().addComponents(button);
      const embed = new EmbedBuilder()
        .setTitle(`License Information - ${license.key}`)
        .addFields([
          {
            name: "License key",
            value: `${license.key}`,
          },
          {
            name: "License created by",
            value: `<@${license.author}>`,
          },
          {
            name: "License created at",
            value: `${license.createdAt
              .getDate()
              .toLocaleString(interaction.guildLocale)}/${license.createdAt
              .getMonth()
              .toLocaleString(interaction.guildLocale)}/${license.createdAt
              .getFullYear()
              .toLocaleString(interaction.guildLocale)} ${license.createdAt
              .getHours()
              .toLocaleString(interaction.guildLocale)}:${license.createdAt
              .getMinutes()
              .toLocaleString(interaction.guildLocale)}:${license.createdAt
              .getSeconds()
              .toLocaleString(interaction.guildLocale)}`,
          },
          {
            name: "License last updated at",
            value: `${license.updatedAt
              .getDate()
              .toLocaleString(interaction.guildLocale)}/${license.updatedAt
              .getMonth()
              .toLocaleString(interaction.guildLocale)}/${license.updatedAt
              .getFullYear()
              .toLocaleString(interaction.guildLocale)} ${license.updatedAt
              .getHours()
              .toLocaleString(interaction.guildLocale)}:${license.updatedAt
              .getMinutes()
              .toLocaleString(interaction.guildLocale)}:${license.updatedAt
              .getSeconds()
              .toLocaleString(interaction.guildLocale)}`,
          },
          {
            name: "License time",
            value: `${licenseTime}`,
          },
        ])
        .setColor("#2f3136")
        .setTimestamp()
        .setFooter({ text: "Licensy v3" });

      license.activated &&
        embed.addFields([
          {
            name: "License redeemed by",
            value: `<@${license.redeemer}>`,
          },
        ]);
      license.activated &&
        embed.addFields([
          {
            name: "License will expire at",
            value: `${new Date(
              Number(license.validUntil) +
                license.updatedAt.getTime() -
                license.createdAt.getTime()
            )
              .getDate()
              .toLocaleString(interaction.guildLocale)}/${new Date(
              Number(license.validUntil) +
                license.updatedAt.getTime() -
                license.createdAt.getTime()
            )
              .getMonth()
              .toLocaleString(interaction.guildLocale)}/${new Date(
              Number(license.validUntil) +
                license.updatedAt.getTime() -
                license.createdAt.getTime()
            )
              .getFullYear()
              .toLocaleString(interaction.guildLocale)} ${new Date(
              Number(license.validUntil) +
                license.updatedAt.getTime() -
                license.createdAt.getTime()
            )
              .getHours()
              .toLocaleString(interaction.guildLocale)}:${new Date(
              Number(license.validUntil) +
                license.updatedAt.getTime() -
                license.createdAt.getTime()
            )
              .getMinutes()
              .toLocaleString(interaction.guildLocale)}:${new Date(
              Number(license.validUntil) +
                license.updatedAt.getTime() -
                license.createdAt.getTime()
            )
              .getSeconds()
              .toLocaleString(interaction.guildLocale)}`,
          },
        ]);
      interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
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
