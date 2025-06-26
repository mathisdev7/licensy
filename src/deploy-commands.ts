import {
  REST,
  Routes,
  type RESTPostAPIApplicationCommandsJSONBody,
  type RESTPostAPIApplicationGuildCommandsJSONBody,
  type RESTPutAPIApplicationCommandsJSONBody,
  type RESTPutAPIApplicationGuildCommandsJSONBody,
} from "discord.js";
import { URL, fileURLToPath } from "node:url";

import { loadStructures } from "./misc/util.js";

import type { Command } from "./structures/command.js";

const commands:
  | RESTPostAPIApplicationCommandsJSONBody[]
  | RESTPostAPIApplicationGuildCommandsJSONBody[] = [];

const premiumCommands:
  | RESTPostAPIApplicationCommandsJSONBody[]
  | RESTPostAPIApplicationGuildCommandsJSONBody[] = [];

const commandFolderPath = fileURLToPath(new URL("commands", import.meta.url));
const commandFiles: Command[] = await loadStructures(commandFolderPath, [
  "data",
  "execute",
]);

for (const command of commandFiles) {
  if (command.opt.category !== "Premium") {
    commands.push(command.data);
  }
}
for (const command of commandFiles) {
  if (command.opt.category === "Premium") {
    premiumCommands.push(command.data);
  }
}
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    let data:
      | RESTPutAPIApplicationCommandsJSONBody[]
      | RESTPutAPIApplicationGuildCommandsJSONBody[] = [];

    if (process.env.GUILD_ID) {
      data = (await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          process.env.GUILD_ID
        ),
        { body: premiumCommands }
      )) as RESTPutAPIApplicationGuildCommandsJSONBody[];
    }
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: [],
    });
    data = (await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    })) as RESTPutAPIApplicationCommandsJSONBody[];

    console.log(
      `Successfully reloaded ${data.length} application (/) commands ${
        process.env.GUILD_ID ? `in guild ${process.env.GUILD_ID}` : ""
      }.`
    );
  } catch (error) {
    console.error(error);
  }
})();
