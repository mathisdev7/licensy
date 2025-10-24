import { Collection, Events, MessageFlags, TextChannel, bold, inlineCode } from "discord.js";

import { missingPerms } from "../../misc/util.js";

import type { Event } from "../../structures/event.js";

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inCachedGuild()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command?.data) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      await interaction.reply({
        content: `⚠️ There is no command matching ${inlineCode(
          interaction.commandName
        )}!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      command.opt?.category === "License" &&
      command.data.name !== "license-ban"
    ) {
      const prisma = interaction.client.prisma;
      const existingBan = await prisma.licenseBan.findFirst({
        where: {
          guildId: interaction.guild.id,
          userId: interaction.user.id,
        },
      });
      if (existingBan) {
        if (existingBan.expiresAt && existingBan.expiresAt <= new Date()) {
          await prisma.licenseBan.delete({ where: { id: existingBan.id } });
        } else {
          await interaction.reply({
            content: `⚠️ You are banned from executing license commands${
              existingBan.expiresAt
                ? ` until ${existingBan.expiresAt.toLocaleString(interaction.guildLocale)}`
                : ""
            }${existingBan.reason ? `\nReason: ${existingBan.reason.slice(0, 300)}` : ""}.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
    }

    if (command.opt?.userPermissions) {
      const channelPermissions = interaction.member.permissionsIn(
        interaction.channel
      );
      const missingUserPerms = missingPerms(
        channelPermissions,
        command.opt.userPermissions
      );

      if (missingUserPerms.length) {
        const prisma = interaction.client.prisma;
        const logs = await prisma.logs.findFirst({
          where: { guildId: interaction.guild.id },
        });
        if (!logs) return;
        const logChannel = interaction.client.channels.cache.get(logs.channel);
        if (!logChannel) return;
        if (logs.activated === false) return;

        if (logChannel instanceof TextChannel) {
          await logChannel.send({
            content: `⚠️ ${
              interaction.user.tag
            } tried to use the command /${inlineCode(
              command.data.name
            )} but is missing the following permission${
              missingUserPerms.length > 1 ? "s" : ""
            }: ${missingUserPerms.map((x) => inlineCode(x)).join(", ")}`,
          });
        }
        await interaction.reply({
          content: `⚠️ You need the following permission${
            missingUserPerms.length > 1 ? "s" : ""
          }: ${missingUserPerms.map((x) => inlineCode(x)).join(", ")}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    if (command.opt?.botPermissions) {
      const botChannelPermissions = interaction.guild.members.me.permissionsIn(
        interaction.channel
      );
      const missingBotPerms = missingPerms(
        botChannelPermissions,
        command.opt.botPermissions
      );

      if (missingBotPerms.length) {
        await interaction.reply({
          content: `⚠️ I need the following permission${
            missingBotPerms.length > 1 ? "s" : ""
          }: ${missingBotPerms.map((x) => inlineCode(x)).join(", ")}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    if (command.opt?.cooldown) {
      if (
        !interaction.client.cooldown.has(
          `${command.data.name}-${interaction.guildId}`
        )
      ) {
        interaction.client.cooldown.set(
          `${command.data.name}-${interaction.guildId}`,
          new Collection()
        );
      }

      const now = Date.now();
      const timestamps = interaction.client.cooldown.get(
        `${command.data.name}-${interaction.guildId}`
      );
      const cooldownAmount = (command.opt.cooldown ?? 3) * 1000;

      if (timestamps.has(interaction.user.id)) {
        const expirationTime =
          timestamps.get(interaction.user.id) + cooldownAmount;

        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;

          await interaction.reply({
            content: `⚠️ Please wait ${bold(
              `${timeLeft.toFixed()} second(s)`
            )} before reusing this command!`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: `⚠️ There was an error while executing this command:\n${message}\nCheck the console for more info.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: `⚠️ There was an error while executing this command:\n${message}\nCheck the console for more info.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } else {
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: `⚠️ There was an error while executing this command:\n${message}\nCheck the console for more info.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: `⚠️ There was an error while executing this command:\n${message}\nCheck the console for more info.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
  },
} satisfies Event<Events.InteractionCreate>;
