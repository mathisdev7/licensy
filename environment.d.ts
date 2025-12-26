import type { Collection, Locale } from "discord.js";
import type { ExtendedClient } from "./src/structures/client.js";
import type { Command } from "./src/structures/command.js";
import type { licenseData } from "./src/types/licenseData.js";

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

type PrismaClient = import("./prisma/generated/client.js").PrismaClient;

declare module "discord.js" {
  interface Client {
    prisma: PrismaClient;
    commands: Collection<string, Command>;
    cooldown: Collection<string, Collection<string, number>>;
  }
  interface ClientEvents {
    licenseCreate: [
      client: ExtendedClient,
      licenseData: licenseData[],
      guild: Guild,
      time: string
    ];
    licenseRedeem: [
      client: ExtendedClient,
      licenseData: licenseData,
      guild: Guild,
      time: string,
      member: GuildMember
    ];
    licenseExpired: [
      client: ExtendedClient,
      licenseData: licenseData,
      guild: Guild,
      member: GuildMember
    ];
    licenseStopped: [
      client: ExtendedClient,
      licenseData: licenseData,
      guild: Guild,
      member: GuildMember,
      author: GuildMember,
      localeCached: Locale
    ];
  }
}

export {};
