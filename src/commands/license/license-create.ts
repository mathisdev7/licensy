import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";
import ms from "ms";
import parseMs from "parse-ms-2";
import { generateRandomKey } from "../../misc/util.js";
import { Command } from "../../structures/command.js";
import { licenseData } from "../../types/licenseData.js";
const MAX_LICENSES = 50;
const MAX_LICENSES_PER_COMMAND = 10;
const MAX_LICENSES_PREMIUM = 200;
const MAX_LICENSES_PER_COMMAND_PREMIUM = 30;

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
    userPermissions: ["Administrator"],
    botPermissions: ["SendMessages"],
    category: "License",
    cooldown: 5,
  },
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    try {
      const time = interaction.options.getString("time");
      const amount = interaction.options.getInteger("amount") ?? 1;
      const role = interaction.options.getRole("role");
      const clientToMember = interaction.guild.members.cache.get(
        interaction.client.user.id
      );
      if (clientToMember.roles.highest.comparePositionTo(role) <= 0) {
        interaction.reply({
          content: "The bot's role is lower than the role you want to give.",
          ephemeral: true,
        });
        return;
      }
      const prisma = interaction.client.prisma;
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
          ephemeral: true,
        });
        return;
      }
      const licenseData: licenseData[] = [];
      const maxAmount = Math.min(
        amount,
        isPremium ? MAX_LICENSES_PER_COMMAND_PREMIUM : MAX_LICENSES_PER_COMMAND
      );
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
        .setFooter({ text: "Licensy v3" });
      interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
      interaction.client.emit(
        "licenseCreate",
        interaction.client,
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
