import {
	ApplicationCommandOptionType,
	RESTJSONErrorCodes,
	Routes,
	type ChatInputCommandInteraction,
	MessageFlags,
} from "discord.js";

import type { Command } from "../../structures/command.js";

export default {
	data: {
	  name: "deploy",
	  description: "Deploy the commands to the server.",
	  options: [
		{
			name: "guild",
			description: "The guild to deploy the commands to.",
			type: ApplicationCommandOptionType.String,
			required: false,
		}
	  ]
	},
	opt: {
	  userPermissions: ["Administrator"],
	  botPermissions: ["SendMessages"],
	  category: "General",
	  cooldown: 10,
	},
	async execute(interaction: ChatInputCommandInteraction<"cached">) {
	  try {
		const commands = Array.from(interaction.client.commands.values()) as Command[];
		const commandsToDeploy = commands
        .filter((cmd) => cmd.data.name)
        .map((cmd) => ({
          name: cmd.data.name,
          description: "description" in cmd.data ? (cmd.data).description || "Pas de description" : "Pas de description",
          options: cmd.data.options || [],
          type: 1,
        }));
		const guildId = interaction.options.getString("guild") || interaction.guildId;
		if (guildId && interaction.user.id !== "548028946097111045") {
			await interaction.reply({ content: "You can only deploy commands to the server you are in.", flags: MessageFlags.Ephemeral });
			return;
		}
		if (guildId && interaction.user.id === "548028946097111045") {
			await interaction.client.rest.put(
        Routes.applicationGuildCommands(interaction.client.user.id, guildId),
        { body: commandsToDeploy }
      );
		}

		await interaction.client.rest.put(
      Routes.applicationGuildCommands(interaction.client.user.id, interaction.guildId),
      { body: commandsToDeploy }
    );
		await interaction.reply({ content: "Commands deployed successfully", flags: MessageFlags.Ephemeral });
	  } catch (error) {
		if ((error).code === RESTJSONErrorCodes.UnknownMessage) {
		  console.error(`Failed to edit interaction: ${(error).message}`);
		}
	  }
	},
} satisfies Command;
