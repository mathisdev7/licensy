import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";
import ms from "ms";
import parseMs from "parse-ms-2";
import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-edit",
    description: "Edit a non-active license (role and/or time).",
    options: [
      {
        name: "license",
        description: "The license key to edit.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "role",
        description: "New role to assign to this license.",
        type: ApplicationCommandOptionType.Role,
        required: false,
      },
      {
        name: "time",
        description: "New validity duration (replaces the old one).",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
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
      const licenseKey = interaction.options.getString("license", true);
      const newRole = interaction.options.getRole("role");
      const newTimeStr = interaction.options.getString("time");
      let newTimeMs: number | undefined;

      if (!newRole && !newTimeStr) {
        prisma.$disconnect();
        await interaction.reply({
          content:
            "You must provide at least one option to edit (role or time).",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const license = await prisma.license.findFirst({
        where: {
          guildId: interaction.guild.id,
          key: licenseKey,
          activated: false,
        },
      });

      if (!license) {
        prisma.$disconnect();
        await interaction.reply({
          content:
            "The license key provided does not exist or is already active.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const dataToUpdate: { role?: string; validUntil?: bigint } = {};

      if (newRole) {
        const clientToMember = interaction.guild.members.cache.get(
          interaction.client.user.id
        );
        if (
          clientToMember &&
          clientToMember.roles.highest.comparePositionTo(newRole) <= 0
        ) {
          prisma.$disconnect();
          await interaction.reply({
            content: "The bot's role is lower than the role you want to set.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        dataToUpdate.role = newRole.id;
      }

      if (newTimeStr) {
        newTimeMs = ms(newTimeStr);
        if (!newTimeMs || newTimeMs <= 0) {
          prisma.$disconnect();
          await interaction.reply({
            content: "Please provide a valid time (e.g. 1d 2h 30m).",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        dataToUpdate.validUntil = BigInt(
          license.createdAt.getTime() + newTimeMs
        );
      }

      const updated = await prisma.license.update({
        where: {
          key: license.key,
        },
        data: dataToUpdate,
      });

      const durationBase =
        newTimeMs ?? Number(updated.validUntil) - updated.createdAt.getTime();
      const duration = `${parseMs(durationBase).days} days, ${
        parseMs(durationBase).hours
      } hours, ${parseMs(durationBase).minutes} minutes, ${
        parseMs(durationBase).seconds
      } seconds`;

      const embed = new EmbedBuilder()
        .setTitle("License Edited")
        .setDescription(
          `License \`${updated.key}\` has been updated.\n\n- Role: <@&${updated.role}>\n- Duration: ${duration}`
        )
        .setColor("#2f3136")
        .setTimestamp()
        .setFooter({ text: "Licensy" });

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      prisma.$disconnect();
    } catch (error) {
      if (
        (error as { code?: number }).code === RESTJSONErrorCodes.UnknownMessage
      ) {
        console.error(
          `Failed to edit interaction: ${(error as Error).message}`
        );
      }
    }
  },
} satisfies Command;
