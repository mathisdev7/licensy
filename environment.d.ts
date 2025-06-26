import type { Collection } from "discord.js";
import type { Command } from "./src/structures/command.js";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DISCORD_TOKEN: string;
      CLIENT_ID: string;
      GUILD_ID: string;
      DATABASE_URL: string;
      environment: "dev" | "prod" | "debug";
    }
  }
}

type PrismaClient = import("@prisma/client").PrismaClient;

declare module "discord.js" {
  interface Client {
    prisma: PrismaClient;
    commands: Collection<string, Command>;
    cooldown: Collection<string, Collection<string, number>>;
  }
}

export {};
