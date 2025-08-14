import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  RESTJSONErrorCodes,
} from "discord.js";
import ms from "ms";
import parseMs from "parse-ms-2";
import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-extend",
    description: "Extend the time of an active license.",
    options: [
      {
        name: "license",
        description: "The license key to extend.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "time",
        description: "Time to add (e.g. 1d 2h 30m).",
        type: ApplicationCommandOptionType.String,
        required: true,
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
      const timeToAddStr = interaction.options.getString("time", true);
      const timeToAddMs = ms(timeToAddStr);

      if (!timeToAddMs || timeToAddMs <= 0) {
        prisma.$disconnect();
        await interaction.reply({
          content: "Please provide a valid time to add (e.g. 1d 2h 30m).",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const license = await prisma.license.findFirst({
        where: {
          guildId: interaction.guild.id,
          key: licenseKey,
          activated: true,
        },
      });

      if (!license) {
        prisma.$disconnect();
        await interaction.reply({
          content:
            "The license key provided does not exist or is not active.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const newValidUntil = BigInt(Number(license.validUntil) + timeToAddMs);

      const updated = await prisma.license.update({
        where: {
          key: license.key,
        },
        data: {
          validUntil: newValidUntil,
        },
      });

      const remainingMs = Math.max(0, Number(updated.validUntil) - Date.now());
      const remaining = `${parseMs(remainingMs).days} days, ${
        parseMs(remainingMs).hours
      } hours, ${parseMs(remainingMs).minutes} minutes, ${
        parseMs(remainingMs).seconds
      } seconds`;

      const added = `${parseMs(timeToAddMs).days} days, ${
        parseMs(timeToAddMs).hours
      } hours, ${parseMs(timeToAddMs).minutes} minutes, ${
        parseMs(timeToAddMs).seconds
      } seconds`;

      const embed = new EmbedBuilder()
        .setTitle("License Extended")
        .setDescription(
          `License \`${updated.key}\` has been extended.\n\n- Added: ${added}\n- New remaining: ${remaining}`
        )
        .setColor("#2f3136")
        .setTimestamp()
        .setFooter({ text: "Licensy v3" });

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      prisma.$disconnect();
    } catch (error) {
      if ((error as { code?: number }).code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${(error as Error).message}`);
      }
    }
  },
} satisfies Command;

