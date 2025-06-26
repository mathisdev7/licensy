import {
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
    name: "premium-list",
    description: "List premium users and their guild(s).",
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
      const premiums = await prisma.premium.findMany({});
      const premiumList = premiums.map((premium) => {
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
        return `User: ${premium.userId}, Guild: ${premium.guildId}, Valid until: ${validUntil}`;
      });
      const embed = new EmbedBuilder()
        .setTitle("Premium List")
        .setDescription(
          premiumList.length > 0 ? premiumList.join("\n") : "No premium users."
        )
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
