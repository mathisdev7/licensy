import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { Command } from "../../structures/command.js";

const ALLOWED_USERS = [
  "548028946097111045",
  "922135633160441876",
  "526877994019586060",
];

export default {
  data: {
    name: "premium-info",
    description: "Get premium user and guild's information.",
    options: [
      {
        name: "user",
        description: "The user to get premium information.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "guildid",
        description: "The guild to get premium information.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  opt: {
    userPermissions: [],
    botPermissions: ["SendMessages"],
    category: "Premium",
    cooldown: 5,
  },
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    try {
      if (!ALLOWED_USERS.includes(interaction.user.id)) {
        interaction.reply({
          content: "You are not allowed to use this command.",
          ephemeral: true,
        });
        return;
      }
      const prisma = interaction.client.prisma;
      const premium = await prisma.premium.findFirst({
        where: {
          userId: interaction.options.getString("user"),
          guildId: interaction.options.getString("guildid"),
        },
      });
      if (!premium) {
        prisma.$disconnect();
        interaction.reply({
          content: "The user does not have premium in the guild.",
          ephemeral: true,
        });
        return;
      }
      const validUntil = `${new Date(
        Number(premium.validUntil) +
          premium.updatedAt.getTime() -
          premium.createdAt.getTime()
      ).getDate()}/${new Date(
        Number(premium.validUntil) +
          premium.updatedAt.getTime() -
          premium.createdAt.getTime()
      ).getMonth()}/${new Date(
        Number(premium.validUntil) +
          premium.updatedAt.getTime() -
          premium.createdAt.getTime()
      ).getFullYear()} ${new Date(
        Number(premium.validUntil) +
          premium.updatedAt.getTime() -
          premium.createdAt.getTime()
      ).getHours()}:${new Date(
        Number(premium.validUntil) +
          premium.updatedAt.getTime() -
          premium.createdAt.getTime()
      ).getMinutes()}:${new Date(
        Number(premium.validUntil) +
          premium.updatedAt.getTime() -
          premium.createdAt.getTime()
      ).getSeconds()}`;
      const guild = await interaction.client.guilds.fetch(premium.guildId);
      const embed = new EmbedBuilder()
        .setTitle("Premium Info")
        .addFields([
          {
            name: "User",
            value: `<@${premium.userId}>`,
          },
          {
            name: "Guild",
            value: `${guild.name} (${guild.id})`,
          },
          {
            name: "Valid until",
            value: validUntil,
          },
        ])
        .setColor("Blurple")
        .setTimestamp();
      interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
      prisma.$disconnect();
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
