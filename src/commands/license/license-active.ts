import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-active",
    description: "Show the active licenses.",
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
      const licenses = await prisma.license.findMany({
        where: {
          guildId: interaction.guild.id,
          activated: true,
        },
      });
      const button = new ButtonBuilder()
        .setCustomId(
          `get-license-key-${licenses.map((license) => license.key).join("-")}`
        )
        .setLabel(`Copy License Key${licenses.length > 1 ? "s" : ""}`)
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
      const embed = new EmbedBuilder()
        .setTitle("Active Licenses")
        .setDescription(
          licenses.length > 0
            ? `The licenses that are currently active are:\n\n${licenses
                .map((license) => `- \`${license.key}\``)
                .join("\n")}`
            : "There are no active licenses."
        )
        .setColor("#2f3136")
        .setTimestamp()
        .setFooter({ text: "Licensy v3" });

      interaction.reply({
        embeds: [embed],
        components: [row],
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
