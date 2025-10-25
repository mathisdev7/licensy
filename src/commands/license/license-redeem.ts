import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";
import parseMs from "parse-ms-2";

import { ExtendedClient } from "../../structures/client.js";
import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-redeem",
    description: "Redeem a license key.",
    options: [
      {
        name: "license",
        description: "The license key to get information about.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  opt: {
    userPermissions: [],
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
          content:
            "The license key provided does not exist or has already been redeemed.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const interactionReplied = await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });
      const fetchAuthor = await interaction.client.users.fetch(license.author);
      const licenseCreatedAtToMs = license.createdAt.getTime();
      const licenseTimeToMs = Number(license.validUntil) - licenseCreatedAtToMs;
      const licenseTime = `${parseMs(licenseTimeToMs).days} days, ${
        parseMs(licenseTimeToMs).hours
      } hours, ${parseMs(licenseTimeToMs).minutes} minutes, ${
        parseMs(licenseTimeToMs).seconds
      } seconds`;
      await prisma.license.update({
        where: {
          key: license.key,
          guildId: interaction.guild.id,
        },
        data: {
          redeemer: interaction.user.id,
          activated: true,
        },
      });

      await prisma.licenseHistory.create({
        data: {
          guildId: interaction.guild.id,
          licenseKey: license.key,
          action: "REDEEM",
          actorId: interaction.user.id,
          targetId: license.author,
          details: `Redeemed by <@${interaction.user.id}> | Created by <@${license.author}>`,
        },
      });

      const time = `${new Date(
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
        .toLocaleString(interaction.guildLocale)}`;

      const embed = new EmbedBuilder()
        .setTitle(`License redeemed - ${license.key}`)
        .setDescription(
          `This license key has been created by ${fetchAuthor.username}`
        )
        .addFields([
          {
            name: "Role",
            value: `<@&${license.role}>`,
          },
          {
            name: "Time",
            value: `Your key will last for ${licenseTime}\nMeaning it will expire on ${time}`,
          },
          {
            name: "Created at",
            value: `${license.createdAt.getDate()}/${license.createdAt.getMonth()}/${license.createdAt.getFullYear()} ${license.createdAt.getHours()}:${license.createdAt.getMinutes()}:${license.createdAt.getSeconds()}`,
          },
          {
            name: "Last updated at",
            value: `${license.updatedAt.getDate()}/${license.updatedAt.getMonth()}/${license.updatedAt.getFullYear()} ${license.updatedAt.getHours()}:${license.updatedAt.getMinutes()}:${license.updatedAt.getSeconds()}`,
          },
        ])
        .setColor("#2f3136")
        .setTimestamp()
        .setFooter({ text: "Licensy" });

      interactionReplied.edit({
        embeds: [embed],
      });
      await interaction.member.roles.add(license.role, "License redeemed.");
      interaction.client.emit(
        "licenseRedeem",
        interaction.client as ExtendedClient,
        license,
        interaction.guild,
        time,
        interaction.member
      );
      prisma.$disconnect();
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
