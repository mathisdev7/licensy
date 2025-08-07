import {
  ApplicationCommandOptionType,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import ms from "ms";

import type { Command } from "../../structures/command.js";

const ALLOWED_USERS = [
  "548028946097111045",
  "922135633160441876",
  "526877994019586060",
];

export default {
  data: {
    name: "premium-edit",
    description: "Edit premium to a user and a guild.",
    options: [
      {
        name: "user",
        description: "The user to edit premium to.",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: "guildid",
        description: "The guild to edit premium to.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "time",
        description: "The time the premium will be valid for.",
        type: ApplicationCommandOptionType.String,
        required: false,
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
          flags: MessageFlags.Ephemeral,
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
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await prisma.premium.update({
        where: {
          id: premium.id,
        },
        data: {
          validUntil: ms(interaction.options.getString("time")) + Date.now(),
        },
      });
      const guild = await interaction.client.guilds.fetch(guildId);
      interaction.reply({
        content: `Successfully edited premium for <@${premium.userId}> in ${guild.name}.`,
        flags: MessageFlags.Ephemeral,
      });
      prisma.$disconnect();
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
