import { PrismaClient } from "@prisma/client";
import {
  PermissionsBitField,
  REST,
  Routes,
  type APIEmbed,
  type Message,
  type PermissionResolvable,
  type PermissionsString,
  type RESTPostAPIApplicationCommandsJSONBody,
  type RESTPostAPIApplicationGuildCommandsJSONBody,
  type RESTPutAPIApplicationCommandsJSONBody,
  type RESTPutAPIApplicationGuildCommandsJSONBody,
} from "discord.js";
import { readdirSync, type PathLike } from "node:fs";
import { join } from "node:path";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

import type { Command } from "../structures/command.js";

export async function dynamicImport(path: string): Promise<any> {
  const module = await import(pathToFileURL(path).toString());
  return module?.default;
}

export async function loadStructures(path: PathLike, props: [string, string]) {
  const fileData = [];

  const folders = readdirSync(path);

  for (const folder of folders) {
    const filesPath = join(path.toString(), folder);
    const files = readdirSync(filesPath).filter((file) => file.endsWith(".js"));

    for (const file of files) {
      const filePath = join(filesPath, file);
      const data = await dynamicImport(filePath);

      if (props[0] in data && props[1] in data) fileData.push(data);
      else
        console.warn(
          `\u001b[33m The command at ${filePath} is missing a required ${props[0]} or ${props[1]} property.`
        );
    }
  }

  return fileData;
}

export function missingPerms(
  memberPerms: PermissionResolvable,
  requiredPerms: PermissionResolvable
): PermissionsString[] {
  return new PermissionsBitField(memberPerms).missing(
    new PermissionsBitField(requiredPerms)
  );
}

export function ellipsis(text: string, total: number): string {
  if (text.length <= total) {
    return text;
  }
  const keep = total - 3;
  if (keep < 1) return text.slice(0, total);
  return `${text.slice(0, keep)}...`;
}

export function truncateEmbed(embed: APIEmbed): APIEmbed {
  return {
    ...embed,
    description: embed.description
      ? ellipsis(embed.description, 4096)
      : undefined,
    title: embed.title ? ellipsis(embed.title, 256) : undefined,
    author: embed.author
      ? {
          ...embed.author,
          name: ellipsis(embed.author.name, 256),
        }
      : undefined,
    footer: embed.footer
      ? {
          ...embed.footer,
          text: ellipsis(embed.footer.text, 2048),
        }
      : undefined,
    fields: embed.fields
      ? embed.fields
          .map((field) => ({
            ...field,
            name: ellipsis(field.name, 256),
            value: ellipsis(field.value, 1024),
          }))
          .slice(0, 25)
      : [],
  } as const;
}

export function formatMessageToEmbed(message: Message<true>) {
  const { author, attachments, content, createdAt } = message;

  let embed = truncateEmbed({
    author: {
      name: `${author.discriminator === "0" ? author.username : author.tag} (${
        author.id
      })`,
      icon_url: author.displayAvatarURL(),
    },
    description: content.length ? content : "<No message content>",
    timestamp: createdAt.toISOString(),
    color: 0x2f3136,
  });

  const attachment = attachments.first();
  const attachmentIsImage = ["image/jpeg", "image/png", "image/gif"].includes(
    attachment?.contentType ?? ""
  );
  const attachmentIsImageNaive = [".jpg", ".png", ".gif"].some((ext) =>
    attachment?.name?.endsWith(ext)
  );

  if (attachment && (attachmentIsImage || attachmentIsImageNaive)) {
    embed = {
      ...embed,
      image: {
        url: attachment.url,
      },
    };
  }

  return embed;
}

export async function deployCommands(guildId?: string) {
  const commands:
    | RESTPostAPIApplicationCommandsJSONBody[]
    | RESTPostAPIApplicationGuildCommandsJSONBody[] = [];

  const commandFolderPath = fileURLToPath(
    new URL("../commands", import.meta.url)
  );
  const commandFiles: Command[] = await loadStructures(commandFolderPath, [
    "data",
    "execute",
  ]);
  commandFiles.forEach((command) => {
    commands.push(command.data);
  });

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  (async () => {
    try {
      console.log(
        `Started refreshing ${commands.length} application (/) commands.`
      );

      let data:
        | RESTPutAPIApplicationCommandsJSONBody[]
        | RESTPutAPIApplicationGuildCommandsJSONBody[] = [];

      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
        body: [],
      });
      if (guildId) {
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
          {
            body: commands,
          }
        );
        return console.log(
          `Successfully reloaded ${data.length} application (/) commands ${
            guildId ? `in guild ${guildId}` : ""
          }.`
        );
      }
      data = (await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        {
          body: commands,
        }
      )) as RESTPutAPIApplicationCommandsJSONBody[];

      console.log(
        `Successfully reloaded ${data.length} application (/) commands ${
          process.env.GUILD_ID ? `in guild ${process.env.GUILD_ID}` : ""
        }.`
      );
    } catch (error) {
      console.error(error);
    }
  })();
}

export function generateRandomKey(length: number): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < length; i++) {
    key += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return key;
}

export function isExpired(validUntil: number): boolean {
  const currentTime = Date.now();
  const timeDifference = validUntil - currentTime;
  console.log(timeDifference);
  return timeDifference <= 0;
}

export function manageExpiringOnReady(prisma: PrismaClient, client: any) {
  try {
    setInterval(async () => {
      const licenses = await prisma.license.findMany();
      for (const license of licenses) {
        if (license.activated === false && !license.redeemer) continue;
        console.log(`Vérification de la clé de licence: ${license.key}`);
        if (isExpired(Number(license.validUntil))) {
          const guild = await client.guilds.fetch(license.guildId);
          const member = await guild.members.fetch(license.redeemer);
          client.emit("licenseExpired", client, license, guild, member);
          member.user.send({
            content: `Your license key \`${
              license.key
            }\` has expired.\nAnd the role \`${
              guild.roles.cache.get(license.role).name || "Role not found."
            }\` has been removed from you.`,
          });
          await member.fetch(true);
          await member.roles.remove(license.role);
          await prisma.license.delete({
            where: {
              key: license.key,
            },
          });
        }
      }
    }, 10000);
  } catch (error) {
    console.error(
      `Erreur lors de la gestion des expirations de licence: ${error}`
    );
  }
}

export function managePremiumOnReady(prisma: PrismaClient, client: any) {
  try {
    setInterval(async () => {
      const premiums = await prisma.premium.findMany();
      for (const premium of premiums) {
        if (isExpired(Number(premium.validUntil))) {
          const guild = await client.guilds.fetch(premium.guildId);
          const member = await guild.members.fetch(premium.userId);
          member.user.send({
            content: `Your premium on Licensy has expired.\nYou no longer have premium in the guild \`${guild.name}\`.`,
          });
          await member.fetch(true);
          await prisma.premium.delete({
            where: {
              id: premium.id,
            },
          });
        }
      }
    }, 10000);
  } catch (error) {
    console.error(error);
  }
}
