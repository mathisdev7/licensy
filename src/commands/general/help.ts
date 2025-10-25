import {
  EmbedBuilder,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "help",
    description: "Show all the commands available.",
  },
  opt: {
    userPermissions: [],
    botPermissions: ["SendMessages"],
    category: "General",
    cooldown: 5,
  },
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    try {
      const commands = interaction.client.commands;
      const licenseCommands = commands.filter(
        (command) => (command.opt?.category ?? "General") === "License"
      );
      const licenseCommandsList = licenseCommands.map(
        (command: Command) =>
          `**${command.data.name}**: ${
            "description" in command.data
              ? command.data.description
              : "No description"
          }`
      );
      const embed = new EmbedBuilder()
        .setTitle("License Commands")
        .setDescription(licenseCommandsList.join("\n"))
        .setColor("Blurple")
        .setFooter({ text: "Licensy" })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
