import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";

import type { Command } from "../../structures/command.js";

export default {
  data: {
    name: "license-export",
    description: "Export all license keys as JSON or CSV.",
    options: [
      {
        name: "format",
        description: "The export format.",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: "JSON", value: "json" },
          { name: "CSV", value: "csv" },
        ],
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
      const format = interaction.options.getString("format", true);

      const interactionReplied = await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const licenses = await prisma.license.findMany({
        where: { guildId: interaction.guild.id },
      });

      if (licenses.length === 0) {
        prisma.$disconnect();
        interactionReplied.edit({
          content: "There are no license keys available to export.",
        });
        return;
      }

      const normalized = licenses.map((lic) => ({
        id: lic.id,
        guildId: lic.guildId,
        key: lic.key,
        role: lic.role,
        author: lic.author,
        redeemer: lic.redeemer ?? null,
        activated: lic.activated,
        createdAt: lic.createdAt.toISOString(),
        updatedAt: lic.updatedAt.toISOString(),
        validUntil: Number(lic.validUntil),
      }));

      let filename = "licenses";
      let attachmentBuffer: Buffer;

      if (format === "json") {
        filename += ".json";
        const json = JSON.stringify(normalized, null, 2);
        attachmentBuffer = Buffer.from(json);
      } else {
        filename += ".csv";
        const headers = [
          "id",
          "guildId",
          "key",
          "role",
          "author",
          "redeemer",
          "activated",
          "createdAt",
          "updatedAt",
          "validUntil",
        ];
        const rows = normalized.map((lic) => [
          lic.id,
          lic.guildId,
          lic.key,
          lic.role,
          lic.author,
          lic.redeemer ?? "",
          String(lic.activated),
          lic.createdAt,
          lic.updatedAt,
          String(lic.validUntil),
        ]);
        const csv = [
          headers.join(","),
          ...rows.map((r) => r.map(escapeCsvField).join(",")),
        ].join("\n");
        attachmentBuffer = Buffer.from(csv);
      }

      await interactionReplied.edit({
        content: `Exported ${licenses.length} license${
          licenses.length > 1 ? "s" : ""
        } as ${format.toUpperCase()}.`,
        files: [
          {
            attachment: attachmentBuffer,
            name: filename,
          },
        ],
      });

      prisma.$disconnect();
    } catch (error) {
      console.error(error);
    }
  },
} satisfies Command;

function escapeCsvField(value: string): string {
  const needsQuoting =
    value.includes(",") || value.includes("\n") || value.includes('"');
  if (!needsQuoting) return value;
  return '"' + value.replaceAll('"', '""') + '"';
}
