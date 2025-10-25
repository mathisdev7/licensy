import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";
import ms from "ms";
import parseMs from "parse-ms-2";
import { generateRandomKey } from "../../misc/util.js";
import type { ExtendedClient } from "../../structures/client.js";
import { Command } from "../../structures/command.js";
import { licenseData } from "../../types/licenseData.js";
const MAX_LICENSES = 500;
const MAX_LICENSES_PER_COMMAND = 100;
const MAX_LICENSES_PREMIUM = 2000;
const MAX_LICENSES_PER_COMMAND_PREMIUM = 250;

export default {
  data: {
    name: "license-create",
    description: "Create a license key.",
    options: [
      {
        name: "role",
        description: "The role to give the user.",
        type: ApplicationCommandOptionType.Role,
        required: true,
      },
      {
        name: "time",
        description: "The time the license will be valid for.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "amount",
        description: "The amount of license keys to create.",
        type: ApplicationCommandOptionType.Integer,
        required: false,
      },
    ],
  },
  opt: {
    userPermissions: [],
    botPermissions: ["SendMessages"],
    category: "License",
    cooldown: 5,
  },
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    try {
      const time = interaction.options.getString("time", true);
      const amount = interaction.options.getInteger("amount") ?? 1;
      const role = interaction.options.getRole("role");
      const clientToMember = interaction.guild.members.cache.get(
        interaction.client.user.id
      );
      if (clientToMember.roles.highest.comparePositionTo(role) <= 0) {
        interaction.reply({
          content: "The bot's role is lower than the role you want to give.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const prisma = interaction.client.prisma;
      const managerRoles = await prisma.licenseManager.findMany({
        where: { guildId: interaction.guild.id },
        select: { roleId: true },
      });
      const member = interaction.member;
      const hasAdminPermission = member.permissions.has(
        PermissionsBitField.Flags.Administrator
      );
      const hasManagerRole = member.roles.cache.some((memberRole) =>
        managerRoles.some((managerRole) => managerRole.roleId === memberRole.id)
      );
      if (!hasAdminPermission && managerRoles.length > 0 && !hasManagerRole) {
        await prisma.$disconnect();
        interaction.reply({
          content:
            "You must be an administrator or have a configured role to create license keys.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!hasAdminPermission && managerRoles.length === 0) {
        await prisma.$disconnect();
        interaction.reply({
          content:
            "Only administrators can create license keys until roles are configured.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const licenses = await prisma.license.findMany({
        where: {
          guildId: interaction.guild.id,
        },
      });
      const premium = await prisma.premium.findFirst({
        where: {
          guildId: interaction.guild.id,
        },
      });
      const isPremium = Boolean(premium);
      if (
        (!isPremium && licenses.length + amount > MAX_LICENSES) ||
        (isPremium && licenses.length + amount > MAX_LICENSES_PREMIUM)
      ) {
        prisma.$disconnect();
        interaction.reply({
          content: `You can only create ${
            isPremium ? MAX_LICENSES_PREMIUM : MAX_LICENSES
          } licenses.\n\nYou have ${
            licenses.length
          } licenses and you can only create ${
            isPremium
              ? MAX_LICENSES_PREMIUM - licenses.length
              : MAX_LICENSES - licenses.length
          } licenses for now.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const maxAmount = Math.min(
        amount,
        isPremium ? MAX_LICENSES_PER_COMMAND_PREMIUM : MAX_LICENSES_PER_COMMAND
      );

      const interactionReplied = await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });
      await interactionReplied.edit({
        content: `Generating ${maxAmount} license${
          maxAmount > 1 ? "s" : ""
        }...`,
      });

      const licenseData: licenseData[] = [];
      for (let i = 0; i < maxAmount; i++) {
        const randomKey = generateRandomKey(16);
        const licenseKey = await prisma.license.create({
          data: {
            guildId: interaction.guild.id,
            key: String(randomKey),
            role: role.id,
            author: interaction.user.id,
            validUntil: Date.now() + ms(time),
            activated: false,
          },
        });
        await prisma.licenseHistory.create({
          data: {
            guildId: interaction.guild.id,
            licenseKey: licenseKey.key,
            action: "CREATE",
            actorId: interaction.user.id,
            targetId: role.id,
            details: `Role: <@&${role.id}> | Created by <@${interaction.user.id}>`,
          },
        });
        licenseData.push(licenseKey);
      }
      const embed = new EmbedBuilder()
        .setTitle("License Created")
        .setDescription(
          `The license key has been created:\n\n${licenseData
            .map(
              (license) =>
                `- \`${license.key}\` -> ${parseMs(ms(time)).days} days, ${
                  parseMs(ms(time)).hours
                } hours, ${parseMs(ms(time)).minutes} minutes, ${
                  parseMs(ms(time)).seconds
                } seconds -> ${role}`
            )
            .join("\n")}`
        )
        .setColor("#2f3136")
        .setTimestamp()
        .setFooter({ text: "Licensy" });
      interactionReplied.edit({
        content: "",
        embeds: [embed],
      });
      interaction.client.emit(
        "licenseCreate",
        interaction.client as ExtendedClient,
        licenseData,
        interaction.guild,
        time
      );
      prisma.$disconnect();
    } catch (error) {
      console.error(error);
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies Command;
