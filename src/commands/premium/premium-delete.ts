import {
  ApplicationCommandOptionType,
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
    name: "premium-delete",
    description: "Delete premium to a user and a guild.",
    options: [
      {
        name: "user",
        description: "The user to delete premium to.",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: "guildid",
        description: "The guild to delete premium to.",
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
      const user = interaction.options.getUser("user");
      const guildId = interaction.options.getString("guildid");
      const prisma = interaction.client.prisma;
      const premium = await prisma.premium.findFirst({
        where: {
          userId: user.id,
          guildId: guildId,
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
      await prisma.premium.delete({
        where: {
          id: premium.id,
        },
      });
      const guild = await interaction.client.guilds.fetch(guildId);
      interaction.reply({
        content: `Successfully deleted premium for <@${premium.userId}> in ${guild.name}.`,
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
