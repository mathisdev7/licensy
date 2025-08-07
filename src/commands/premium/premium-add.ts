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
    name: "premium-add",
    description: "Add premium to a user and a guild.",
    options: [
      {
        name: "user",
        description: "The user to add premium to.",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: "time",
        description: "The time the premium will be valid for.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "guildid",
        description: "The guild to add premium to.",
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
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const user = interaction.options.getUser("user");
      const time = interaction.options.getString("time");
      const guildId = interaction.options.getString("guildid");
      const prisma = interaction.client.prisma;
      const premium = await prisma.premium.findFirst({
        where: {
          userId: user.id,
          guildId: guildId,
        },
      });
      const isInGuild = await interaction.client.guilds.fetch(guildId);
      if (!isInGuild) {
        prisma.$disconnect();
        interaction.reply({
          content: "This guild does not exist.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (premium) {
        prisma.$disconnect();
        interaction.reply({
          content: "This user already has premium in this guild.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await prisma.premium.create({
        data: {
          userId: user.id,
          guildId: guildId,
          validUntil: Date.now() + ms(time),
        },
      });
      const userFetched = await interaction.client.users.fetch(user.id);
      userFetched.send({
        content: `You have been given premium for **${time}** in \`${isInGuild.name}\`.`,
      });
      interaction.reply({
        content: `Added premium to ${user.tag} for ${time} in ${isInGuild.name}.`,
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
