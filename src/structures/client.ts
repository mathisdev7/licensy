import { PrismaClient } from "@prisma/client";
import { Client, Collection, GatewayIntentBits } from "discord.js";
import { URL, fileURLToPath } from "node:url";

import { loadStructures } from "../misc/util.js";

import type { Command } from "./command.js";
import type { Event } from "./event.js";

export class ExtendedClient extends Client {
  constructor() {
    super({
      intents: [GatewayIntentBits.Guilds],
      failIfNotExists: false,
      rest: {
        retries: 3,
        timeout: 15_000,
      },
    });
    this.prisma = new PrismaClient();
    this.commands = new Collection<string, Command>();
    this.cooldown = new Collection<string, Collection<string, number>>();
  }

  private async loadModules() {
    const commandFolderPath = fileURLToPath(
      new URL("../commands", import.meta.url)
    );
    const commandFiles: Command[] = await loadStructures(commandFolderPath, [
      "data",
      "execute",
    ]);

    for (const command of commandFiles) {
      this.commands.set(command.data.name, command);
    }

    const eventFolderPath = fileURLToPath(
      new URL("../events", import.meta.url)
    );
    const eventFiles: Event[] = await loadStructures(eventFolderPath, [
      "name",
      "execute",
    ]);

    for (const event of eventFiles) {
      this[event.once ? "once" : "on"](event.name, async (...args) =>
        event.execute(...args)
      );
    }
  }

  private setupErrorHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
    });

    this.on('error', (error) => {
      console.error('Discord client error:', error);
    });

    this.on('warn', (warning) => {
      console.warn('Discord client warning:', warning);
    });
  }

  async start() {
    this.setupErrorHandlers();
    await this.loadModules();
    await this.login(process.env.DISCORD_TOKEN);
    const shutdown = async () => {
      try {
        await this.prisma.$disconnect();
      } catch {}
      process.exit(0);
    };
    process.on("beforeExit", async () => {
      await this.prisma.$disconnect();
    });
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}
