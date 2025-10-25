import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";
import pkg from "lodash";
import ms from "ms";
import parseMs from "parse-ms-2";
import { ensureCanManageLicenses } from "../../misc/licensePermissions.js";
import { generateRandomKey } from "../../misc/util.js";
import type { ExtendedClient } from "../../structures/client.js";
import { Command } from "../../structures/command.js";
import type { licenseData } from "../../types/licenseData.js";

const { chunk } = pkg;

const MAX_TEMPLATE_NAME_LENGTH = 64;
const MAX_LICENSES = 500;
const MAX_LICENSES_PER_COMMAND = 100;
const MAX_LICENSES_PREMIUM = 2000;
const MAX_LICENSES_PER_COMMAND_PREMIUM = 250;
const STOCK_CONFLICT_ERROR = "TEMPLATE_STOCK_CONFLICT";

export default {
  data: {
    name: "license-templates",
    description:
      "Manage reusable license templates for generating license keys.",
    options: [
      {
        name: "create",
        description: "Create a new license template.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "name",
            description: "Template identifier (unique per guild).",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "role",
            description:
              "Role granted when licenses from this template are redeemed.",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
          {
            name: "time",
            description:
              "Duration for generated licenses (e.g. 30d, 12h, 1w2d).",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "stock",
            description: "Optional stock limit. Leave empty for unlimited.",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
        ],
      },
      {
        name: "delete",
        description: "Delete an existing license template.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "name",
            description: "Template name to delete.",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "edit",
        description: "Edit an existing license template.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "name",
            description: "Template name to edit.",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "new-name",
            description: "New template name.",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "role",
            description: "Update the role granted by this template.",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "time",
            description: "Update license duration (e.g. 30d, 12h, 1w2d).",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "stock",
            description: "Set a new stock limit. Must be >= generated keys.",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "unlimited",
            description: "Set stock to unlimited.",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
          },
        ],
      },
      {
        name: "add-stock",
        description: "Add additional stock to a limited template.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "name",
            description: "Template to update.",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "amount",
            description: "Number of additional keys to allow.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
        ],
      },
      {
        name: "generate",
        description: "Generate license keys using a stored template.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "name",
            description: "Template name to generate from.",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "amount",
            description: "Number of license keys to generate (default: 1).",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
        ],
      },
      {
        name: "list",
        description: "List license templates with pagination.",
        type: ApplicationCommandOptionType.Subcommand,
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
    const prisma = interaction.client.prisma;
    try {
      const canManage = await ensureCanManageLicenses(interaction);
      if (!canManage) {
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === "create") {
        const rawName = interaction.options.getString("name", true).trim();
        if (rawName.length === 0) {
          await interaction.reply({
            content: "Template name cannot be empty.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (rawName.length > MAX_TEMPLATE_NAME_LENGTH) {
          await interaction.reply({
            content: `Template name must be at most ${MAX_TEMPLATE_NAME_LENGTH} characters.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const role = interaction.options.getRole("role", true);
        const clientMember = interaction.guild.members.cache.get(
          interaction.client.user.id
        );
        if (
          clientMember &&
          clientMember.roles.highest.comparePositionTo(role) <= 0
        ) {
          await interaction.reply({
            content:
              "The bot's role is lower than the role configured on this template.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const timeInput = interaction.options.getString("time", true);
        const parsedDuration = ms(timeInput);
        if (!parsedDuration || parsedDuration <= 0) {
          await interaction.reply({
            content:
              "Invalid duration. Use a format like `30d`, `12h`, or `1w2d`.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const stockInput = interaction.options.getInteger("stock");
        if (stockInput !== null && stockInput <= 0) {
          await interaction.reply({
            content: "Stock must be a positive number when provided.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const existingTemplate = await prisma.licenseTemplate.findFirst({
          where: {
            guildId,
            name: {
              equals: rawName,
              mode: "insensitive",
            },
          },
        });

        if (existingTemplate) {
          await interaction.reply({
            content: "A template with that name already exists.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const createdTemplate = await prisma.licenseTemplate.create({
          data: {
            guildId,
            name: rawName,
            roleId: role.id,
            durationMs: BigInt(parsedDuration),
            stock: stockInput ?? null,
            createdBy: interaction.user.id,
          },
        });

        const durationParts = parseMs(parsedDuration);
        const embed = new EmbedBuilder()
          .setTitle("License Template Created")
          .setDescription(
            [
              `**Name:** ${createdTemplate.name}`,
              `**Role:** <@&${createdTemplate.roleId}>`,
              `**Duration:** ${durationParts.days}d ${durationParts.hours}h ${durationParts.minutes}m ${durationParts.seconds}s`,
              `**Stock:** ${
                createdTemplate.stock !== null
                  ? `${createdTemplate.stock} total`
                  : "Unlimited"
              }`,
            ].join("\n")
          )
          .setColor("#2f3136")
          .setFooter({ text: "Licensy" })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === "delete") {
        const rawName = interaction.options.getString("name", true).trim();
        if (rawName.length === 0) {
          await interaction.reply({
            content: "Template name cannot be empty.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const template = await prisma.licenseTemplate.findFirst({
          where: {
            guildId,
            name: {
              equals: rawName,
              mode: "insensitive",
            },
          },
        });

        if (!template) {
          await interaction.reply({
            content: "No template found with that name.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await prisma.licenseTemplate.delete({
          where: { id: template.id },
        });

        const embed = new EmbedBuilder()
          .setTitle("License Template Deleted")
          .setDescription(
            [
              `**Name:** ${template.name}`,
              `**Role:** <@&${template.roleId}>`,
              `**Generated Keys:** ${template.generatedCount}`,
              `**Stock Limit:** ${
                template.stock !== null ? template.stock : "Unlimited"
              }`,
            ].join("\n")
          )
          .setColor("#2f3136")
          .setFooter({ text: "Licensy" })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === "edit") {
        const rawName = interaction.options.getString("name", true).trim();
        if (rawName.length === 0) {
          await interaction.reply({
            content: "Template name cannot be empty.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const template = await prisma.licenseTemplate.findFirst({
          where: {
            guildId,
            name: {
              equals: rawName,
              mode: "insensitive",
            },
          },
        });

        if (!template) {
          await interaction.reply({
            content: "No template found with that name.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const updates: Record<string, unknown> = {};
        let hasChanges = false;

        const newNameRaw = interaction.options.getString("new-name");
        if (newNameRaw !== null) {
          const trimmed = newNameRaw.trim();
          if (trimmed.length === 0) {
            await interaction.reply({
              content: "New template name cannot be empty.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          if (trimmed.length > MAX_TEMPLATE_NAME_LENGTH) {
            await interaction.reply({
              content: `Template name must be at most ${MAX_TEMPLATE_NAME_LENGTH} characters.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const conflictingTemplate = await prisma.licenseTemplate.findFirst({
            where: {
              guildId,
              name: {
                equals: trimmed,
                mode: "insensitive",
              },
              NOT: {
                id: template.id,
              },
            },
          });

          if (conflictingTemplate) {
            await interaction.reply({
              content: "Another template already uses that name.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          updates.name = trimmed;
          hasChanges = true;
        }

        const role = interaction.options.getRole("role");
        if (role) {
          const clientMember = interaction.guild.members.cache.get(
            interaction.client.user.id
          );
          if (
            clientMember &&
            clientMember.roles.highest.comparePositionTo(role) <= 0
          ) {
            await interaction.reply({
              content:
                "The bot's role is lower than the updated role for this template.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          updates.roleId = role.id;
          hasChanges = true;
        }

        const newTime = interaction.options.getString("time");
        if (newTime) {
          const parsed = ms(newTime);
          if (!parsed || parsed <= 0) {
            await interaction.reply({
              content:
                "Invalid duration. Use a format like `30d`, `12h`, or `1w2d`.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          updates.durationMs = BigInt(parsed);
          hasChanges = true;
        }

        const unlimited = interaction.options.getBoolean("unlimited");
        const stockValue = interaction.options.getInteger("stock");

        if (unlimited && stockValue !== null) {
          await interaction.reply({
            content: "Choose either unlimited stock or a specific stock value.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (stockValue !== null) {
          if (stockValue <= 0) {
            await interaction.reply({
              content: "Stock must be a positive number.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          if (stockValue < template.generatedCount) {
            await interaction.reply({
              content:
                "Stock cannot be lower than the number of keys already generated from this template.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          updates.stock = stockValue;
          hasChanges = true;
        } else if (unlimited) {
          updates.stock = null;
          hasChanges = true;
        }

        if (!hasChanges) {
          await interaction.reply({
            content: "Nothing to update. Provide at least one new value.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const updatedTemplate = await prisma.licenseTemplate.update({
          where: { id: template.id },
          data: updates,
        });

        const durationParts = parseMs(Number(updatedTemplate.durationMs));
        const remainingStock =
          updatedTemplate.stock !== null
            ? Math.max(
                updatedTemplate.stock - updatedTemplate.generatedCount,
                0
              )
            : null;

        const embed = new EmbedBuilder()
          .setTitle("License Template Updated")
          .setDescription(
            [
              `**Name:** ${updatedTemplate.name}`,
              `**Role:** <@&${updatedTemplate.roleId}>`,
              `**Duration:** ${durationParts.days}d ${durationParts.hours}h ${durationParts.minutes}m ${durationParts.seconds}s`,
              `**Stock:** ${
                updatedTemplate.stock !== null
                  ? `${updatedTemplate.stock} total (${remainingStock} remaining)`
                  : "Unlimited"
              }`,
            ].join("\n")
          )
          .setColor("#2f3136")
          .setFooter({ text: "Licensy" })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === "add-stock") {
        const rawName = interaction.options.getString("name", true).trim();
        if (rawName.length === 0) {
          await interaction.reply({
            content: "Template name cannot be empty.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const amount = interaction.options.getInteger("amount", true);
        if (amount <= 0) {
          await interaction.reply({
            content: "Amount must be a positive number.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const template = await prisma.licenseTemplate.findFirst({
          where: {
            guildId,
            name: {
              equals: rawName,
              mode: "insensitive",
            },
          },
        });

        if (!template) {
          await interaction.reply({
            content: "No template found with that name.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (template.stock === null) {
          await interaction.reply({
            content:
              "This template already has unlimited stock. Remove unlimited mode via `/license-templates edit` before adding stock.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const updatedTemplate = await prisma.licenseTemplate.update({
          where: { id: template.id },
          data: {
            stock: template.stock + amount,
          },
        });

        const remaining = Math.max(
          updatedTemplate.stock - updatedTemplate.generatedCount,
          0
        );

        const embed = new EmbedBuilder()
          .setTitle("License Template Stock Updated")
          .setDescription(
            [
              `**Name:** ${updatedTemplate.name}`,
              `**New Stock:** ${updatedTemplate.stock}`,
              `**Generated Keys:** ${updatedTemplate.generatedCount}`,
              `**Remaining:** ${remaining}`,
            ].join("\n")
          )
          .setColor("#2f3136")
          .setFooter({ text: "Licensy" })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === "generate") {
        const rawName = interaction.options.getString("name", true).trim();
        if (rawName.length === 0) {
          await interaction.reply({
            content: "Template name cannot be empty.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const requestedAmount = interaction.options.getInteger("amount") ?? 1;
        if (requestedAmount <= 0) {
          await interaction.reply({
            content: "Amount must be a positive number.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const template = await prisma.licenseTemplate.findFirst({
          where: {
            guildId,
            name: {
              equals: rawName,
              mode: "insensitive",
            },
          },
        });

        if (!template) {
          await interaction.reply({
            content: "No template found with that name.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (template.stock !== null) {
          const remaining = template.stock - template.generatedCount;
          if (remaining <= 0) {
            await interaction.reply({
              content:
                "This template has no remaining stock. Increase stock before generating more licenses.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          if (requestedAmount > remaining) {
            await interaction.reply({
              content: `Only ${remaining} license${
                remaining > 1 ? "s are" : " is"
              } remaining for this template.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }

        const templateRole = interaction.guild.roles.cache.get(template.roleId);
        if (!templateRole) {
          await interaction.reply({
            content:
              "The role configured for this template no longer exists. Update the template before generating licenses.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const clientMember = interaction.guild.members.cache.get(
          interaction.client.user.id
        );
        if (
          clientMember &&
          clientMember.roles.highest.comparePositionTo(templateRole) <= 0
        ) {
          await interaction.reply({
            content:
              "The bot's role is lower than the role configured on this template.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const licensesCount = await prisma.license.count({
          where: { guildId },
        });
        const premium = await prisma.premium.findFirst({
          where: { guildId },
        });
        const isPremium = Boolean(premium);

        const perCommandLimit = isPremium
          ? MAX_LICENSES_PER_COMMAND_PREMIUM
          : MAX_LICENSES_PER_COMMAND;
        if (requestedAmount > perCommandLimit) {
          await interaction.reply({
            content: `You can generate at most ${perCommandLimit} licenses per command.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const globalLimit = isPremium ? MAX_LICENSES_PREMIUM : MAX_LICENSES;
        if (licensesCount + requestedAmount > globalLimit) {
          await interaction.reply({
            content: `Generating ${requestedAmount} licenses would exceed the guild limit of ${globalLimit}.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          const createdLicenses = await prisma.$transaction<licenseData[]>(
            async (tx) => {
              const updateResult = await tx.licenseTemplate.updateMany({
                where:
                  template.stock !== null
                    ? {
                        id: template.id,
                        generatedCount: template.generatedCount,
                        stock: template.stock,
                      }
                    : {
                        id: template.id,
                        generatedCount: template.generatedCount,
                        stock: null,
                      },
                data: {
                  generatedCount: {
                    increment: requestedAmount,
                  },
                },
              });

              if (updateResult.count === 0) {
                throw new Error(STOCK_CONFLICT_ERROR);
              }

              const created: licenseData[] = [];
              for (let i = 0; i < requestedAmount; i++) {
                const key = generateRandomKey(16);
                const validUntil = BigInt(Date.now()) + template.durationMs;
                const license = await tx.license.create({
                  data: {
                    guildId,
                    key,
                    role: template.roleId,
                    author: interaction.user.id,
                    validUntil,
                    activated: false,
                    templateId: template.id,
                  },
                });
                await tx.licenseHistory.create({
                  data: {
                    guildId,
                    licenseKey: license.key,
                    action: "CREATE",
                    actorId: interaction.user.id,
                    targetId: template.roleId,
                    details: `Template: ${template.name} | Role: <@&${template.roleId}> | Created by <@${interaction.user.id}>`,
                  },
                });
                created.push(license as unknown as licenseData);
              }

              return created;
            }
          );

          const durationMsNumber = Number(template.durationMs);
          const durationParts = parseMs(durationMsNumber);
          const updatedGeneratedCount =
            template.generatedCount + requestedAmount;
          const remainingStock =
            template.stock !== null
              ? Math.max(template.stock - updatedGeneratedCount, 0)
              : null;

          const embed = new EmbedBuilder()
            .setTitle("License Keys Generated")
            .setDescription(
              createdLicenses
                .map(
                  (license) =>
                    `- \`${license.key}\` -> ${durationParts.days}d ${durationParts.hours}h ${durationParts.minutes}m ${durationParts.seconds}s -> <@&${template.roleId}>`
                )
                .join("\n")
            )
            .addFields([
              {
                name: "Template",
                value: template.name,
                inline: true,
              },
              ...(remainingStock !== null
                ? [
                    {
                      name: "Stock Remaining",
                      value: String(remainingStock),
                      inline: true,
                    },
                  ]
                : []),
            ])
            .setColor("#2f3136")
            .setFooter({ text: "Licensy" })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });

          const durationString =
            ms(durationMsNumber) ?? String(durationMsNumber);
          (interaction.client as ExtendedClient).emit(
            "licenseCreate",
            interaction.client as ExtendedClient,
            createdLicenses,
            interaction.guild,
            durationString
          );
        } catch (error) {
          console.error(error);
          if (
            error instanceof Error &&
            error.message === STOCK_CONFLICT_ERROR
          ) {
            await interaction.editReply({
              content:
                "Template stock changed while generating. No licenses were created. Please try again.",
            });
            return;
          }

          if (
            (error as { code?: number }).code ===
            RESTJSONErrorCodes.UnknownMessage
          ) {
            console.error(
              `Failed to edit interaction: ${(error as Error).message}`
            );
            return;
          }

          await interaction.editReply({
            content: "Failed to generate licenses from this template.",
          });
        }
        return;
      }

      if (subcommand === "list") {
        const templates = await prisma.licenseTemplate.findMany({
          where: { guildId },
          orderBy: { createdAt: "desc" },
        });

        if (!templates.length) {
          await interaction.reply({
            content: "No license templates configured yet.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const templatesChunks = chunk(templates, 5);
        let currentPage = 0;

        const leftButton = new ButtonBuilder()
          .setCustomId("template-left")
          .setLabel("<")
          .setStyle(ButtonStyle.Secondary);
        const rightButton = new ButtonBuilder()
          .setCustomId("template-right")
          .setLabel(">")
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          leftButton,
          rightButton
        );

        const buildEmbed = (pageIndex: number) => {
          const pageTemplates = templatesChunks[pageIndex];
          const description = pageTemplates
            .map((template) => {
              const durationParts = parseMs(Number(template.durationMs));
              const stockInfo =
                template.stock !== null
                  ? `${template.stock} total (${Math.max(
                      template.stock - template.generatedCount,
                      0
                    )} remaining)`
                  : "Unlimited";
              return [
                `**${template.name}**`,
                `Role: <@&${template.roleId}>`,
                `Duration: ${durationParts.days}d ${durationParts.hours}h ${durationParts.minutes}m ${durationParts.seconds}s`,
                `Stock: ${stockInfo}`,
                `Generated: ${template.generatedCount}`,
              ].join("\n");
            })
            .join("\n\n");

          return new EmbedBuilder()
            .setTitle("License Templates")
            .setDescription(description)
            .setColor("#2f3136")
            .setFooter({
              text: `Licensy - Page ${pageIndex + 1}/${templatesChunks.length}`,
            })
            .setTimestamp();
        };

        const reply = await interaction.deferReply({
          flags: MessageFlags.Ephemeral,
        });

        if (templatesChunks.length === 1) {
          await reply.edit({
            embeds: [buildEmbed(currentPage)],
            components: [],
          });
          return;
        }

        await reply.edit({
          embeds: [buildEmbed(currentPage)],
          components: [row],
        });

        const collector = interaction.channel?.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 300000,
        });

        collector?.on("collect", async (buttonInteraction) => {
          if (buttonInteraction.user.id !== interaction.user.id) {
            buttonInteraction.reply({
              content: "Only the command invoker can use these buttons.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (buttonInteraction.customId === "template-right") {
            currentPage = (currentPage + 1) % templatesChunks.length;
          } else if (buttonInteraction.customId === "template-left") {
            currentPage =
              (currentPage - 1 + templatesChunks.length) %
              templatesChunks.length;
          } else {
            return;
          }

          await buttonInteraction.update({
            embeds: [buildEmbed(currentPage)],
            components: [row],
          });
        });

        collector?.on("end", async () => {
          await interaction.editReply({
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                leftButton.setDisabled(true),
                rightButton.setDisabled(true)
              ),
            ],
          });
        });
        return;
      }

      await interaction.reply({
        content: "Unknown subcommand.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error(error);
      if (
        (error as { code?: number }).code === RESTJSONErrorCodes.UnknownMessage
      ) {
        console.error(
          `Failed to edit interaction: ${(error as Error).message}`
        );
      } else if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "Failed to process the license template command.",
        });
      } else {
        await interaction.reply({
          content: "Failed to process the license template command.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  },
} satisfies Command;
