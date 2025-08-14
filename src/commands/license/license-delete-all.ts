import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-delete-all",
    description: "Delete all the license keys.",
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
          activated: false,
        },
      });
      if (licenses.length === 0) {
        prisma.$disconnect();
        interaction.reply({
          content: "There is no licenses keys in the database.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const yesButton = new ButtonBuilder()
        .setCustomId("yes")
        .setLabel("Yes")
        .setStyle(ButtonStyle.Success);
      const noButton = new ButtonBuilder()
        .setCustomId("no")
        .setLabel("No")
        .setStyle(ButtonStyle.Danger);
      interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "Are you sure you want to delete all the license keys?",
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            yesButton,
            noButton
          ),
        ],
      });
      const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });
      collector.on("collect", async (buttonInteraction) => {
        if (buttonInteraction.customId === "yes") {
          interaction.editReply({
            content: "Deleting all the license keys...",
            components: [],
          });
          await prisma.license.deleteMany({
            where: {
              activated: false,
              guildId: interaction.guild.id,
            },
          });
          interaction.editReply({
            content: "All the license keys has been deleted.",
            components: [],
          });
        } else {
          interaction.editReply({
            content: "The operation has been cancelled.",
            components: [],
          });
        }
        collector.stop();
      });
      prisma.$disconnect();
    } catch (error) {
      console.error(`Failed to delete license: ${error.message}`);
    }
  },
} satisfies Command;
