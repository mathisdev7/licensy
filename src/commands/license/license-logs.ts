import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  RESTJSONErrorCodes,
} from "discord.js";

import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-logs",
    description: "Set the license logs channel.",
    options: [
      {
        name: "channel",
        description: "The channel to set as the license logs channel.",
        type: ApplicationCommandOptionType.Channel,
        required: false,
      },
      {
        name: "activate",
        description: "Activate the license logs.",
        type: ApplicationCommandOptionType.Boolean,
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
      const logsChannel = interaction.options.getChannel("channel");
      const activate = interaction.options.getBoolean("activate", false);

      if (logsChannel) {
        const isExistingChannel = await prisma.logs.findFirst({
          where: { guildId: interaction.guild.id },
        });
        if (!isExistingChannel) {
          await prisma.logs.create({
            data: {
              guildId: interaction.guild.id,
              channel: logsChannel.id,
              activated: true,
            },
          });
          interaction.reply({
            content: `The license logs channel has been set to <#${logsChannel.id}>.\nTo deactivate the license logs, use \`/license-logs activate:False\``,
            ephemeral: true,
          });
          prisma.$disconnect();
          return;
        }
        if (isExistingChannel.channel === logsChannel.id) {
          prisma.$disconnect();
          interaction.reply({
            content: `The license logs channel is already set to <#${logsChannel.id}>.`,
            ephemeral: true,
          });
          return;
        }
        await prisma.logs.update({
          where: { guildId: interaction.guild.id },
          data: { channel: logsChannel.id },
        });
        interaction.reply({
          content: `The license logs channel has been set to <#${logsChannel.id}>.\nTo deactivate the license logs, use \`/license-logs activate:False\``,
          ephemeral: true,
        });
        prisma.$disconnect();
        return;
      }

      if (typeof activate === "boolean") {
        const isExistingChannel = await prisma.logs.findFirst({
          where: { guildId: interaction.guild.id },
        });
        if (!isExistingChannel) {
          prisma.$disconnect();
          interaction.reply({
            content: `Please provide a channel to set as the license logs channel.`,
            ephemeral: true,
          });
          return;
        }
        if (isExistingChannel.activated === activate) {
          prisma.$disconnect();
          interaction.reply({
            content: `The license logs are already ${
              activate ? "activated" : "deactivated"
            }.`,
            ephemeral: true,
          });
          return;
        }
        await prisma.logs.update({
          where: { guildId: interaction.guild.id },
          data: { activated: activate },
        });
        interaction.reply({
          content: `The license logs have been ${
            activate ? "activated" : "deactivated"
          }.`,
          ephemeral: true,
        });
        prisma.$disconnect();
        return;
      }
      interaction.reply({
        content: "Please provide a channel to set as the license logs channel.",
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
