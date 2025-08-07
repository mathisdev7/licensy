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

import { ErrorConfig, logError } from "../config/errorHandling.js";
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
  const commands: (
    | RESTPostAPIApplicationCommandsJSONBody
    | RESTPostAPIApplicationGuildCommandsJSONBody
  )[] = [];

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

      if (guildId) {
        data = (await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
          { body: commands }
        )) as RESTPutAPIApplicationGuildCommandsJSONBody[];
        console.log(
          `Successfully reloaded ${data.length} application (/) commands in guild ${guildId}.`
        );
        return;
      }
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

export async function safeFetchMember(guild: any, userId: string) {
  try {
    return await guild.members.fetch(userId);
  } catch (error) {
    if (error.code === ErrorConfig.discordErrorCodes.UNKNOWN_MEMBER) {
      logError(`Member ${userId} not found in guild ${guild.id}`, error, 'warn');
    } else if (error.code === ErrorConfig.discordErrorCodes.UNKNOWN_GUILD) {
      logError(`Guild ${guild.id} not found`, error, 'warn');
    } else {
      logError(`Error fetching member ${userId}`, error, 'warn');
    }
    return null;
  }
}

export async function safeFetchGuild(client: any, guildId: string) {
  try {
    return await client.guilds.fetch(guildId);
  } catch (error) {
    if (error.code === ErrorConfig.discordErrorCodes.UNKNOWN_GUILD) {
      logError(`Guild ${guildId} not found`, error, 'warn');
    } else {
      logError(`Error fetching guild ${guildId}`, error, 'warn');
    }
    return null;
  }
}

export async function safeSendDM(user: any, content: string | object) {
  try {
    await user.send(content);
    return true;
  } catch (error) {
    if (error.code === ErrorConfig.discordErrorCodes.CANNOT_SEND_DM) {
      logError(`Cannot send DM to user ${user.tag}: DMs disabled`, error, 'warn');
    } else {
      logError(`Error sending DM to user ${user.tag}`, error, 'warn');
    }
    return false;
  }
}

export async function safeRemoveRole(member: any, roleId: string) {
  try {
    await member.roles.remove(roleId);
    return true;
  } catch (error) {
    if (error.code === ErrorConfig.discordErrorCodes.MISSING_PERMISSIONS) {
      logError(`Missing permissions to remove role ${roleId} from ${member.user.tag}`, error, 'warn');
    } else if (error.code === ErrorConfig.discordErrorCodes.UNKNOWN_ROLE) {
      logError(`Role ${roleId} not found`, error, 'warn');
    } else {
      logError(`Error removing role ${roleId} from ${member.user.tag}`, error, 'warn');
    }
    return false;
  }
}

export function isExpired(validUntil: number): boolean {
  const currentTime = Date.now();
  const timeDifference = validUntil - currentTime;
  return timeDifference <= 0;
}

export function manageExpiringOnReady(client: any) {
  try {
    setInterval(async () => {
      const prisma = client.prisma;
      const licenses = await prisma.license.findMany();
      for (const license of licenses) {
        try {
          if (license.activated === false && !license.redeemer) continue;
          if (isExpired(Number(license.validUntil))) {
            const guild = await safeFetchGuild(client, license.guildId);
            if (!guild) {
              logError(`Guild ${license.guildId} not found, deleting license ${license.key}`, null, 'warn');
              await prisma.license.delete({ where: { key: license.key } });
              continue;
            }

            const member = await safeFetchMember(guild, license.redeemer);
            if (!member) {
              logError(`Member ${license.redeemer} not found in guild ${license.guildId}, deleting license ${license.key}`, null, 'warn');
              await prisma.license.delete({ where: { key: license.key } });
              continue;
            }

            client.emit("licenseExpired", client, license, guild, member);

            await safeSendDM(member.user, {
              content: `Your license key \`${
                license.key
              }\` has expired.\nAnd the role \`${
                guild.roles.cache.get(license.role)?.name || "Role not found."
              }\` has been removed from you.`,
            });

            await safeRemoveRole(member, license.role);

            await prisma.license.delete({
              where: {
                key: license.key,
              },
            });
          }
        } catch (licenseError) {
          logError(`Error processing license ${license.key}`, licenseError, 'error');
        }
      }
    }, 10000);
  } catch (error) {
    logError(`Erreur lors de la gestion des expirations de licence`, error, 'error');
  }
}

export function managePremiumOnReady(client: any) {
  try {
    setInterval(async () => {
      const prisma = client.prisma;
      const premiums = await prisma.premium.findMany();
      for (const premium of premiums) {
        try {
          if (isExpired(Number(premium.validUntil))) {
            const guild = await safeFetchGuild(client, premium.guildId);
            if (!guild) {
              console.warn(`Guild ${premium.guildId} not found, deleting premium ${premium.id}`);
              await prisma.premium.delete({ where: { id: premium.id } });
              continue;
            }

            const member = await safeFetchMember(guild, premium.userId);
            if (!member) {
              console.warn(`Member ${premium.userId} not found in guild ${premium.guildId}, deleting premium ${premium.id}`);
              await prisma.premium.delete({ where: { id: premium.id } });
              continue;
            }

            await safeSendDM(member.user, {
              content: `Your premium on Licensy has expired.\nYou no longer have premium in the guild \`${guild.name}\`.`,
            });

            await prisma.premium.delete({
              where: {
                id: premium.id,
              },
            });
          }
        } catch (premiumError) {
          console.error(`Error processing premium ${premium.id}: ${premiumError}`);
        }
      }
    }, 10000);
  } catch (error) {
    console.error(error);
  }
}
