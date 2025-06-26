import { PrismaClient } from "@prisma/client";
import { EmbedBuilder, Guild } from "discord.js";
import ms from "ms";
import parseMs from "parse-ms-2";
import { licenseData } from "../../types/licenseData.js";

export default {
  name: "licenseCreate" as any,
  once: false,
  async execute(
    client: any,
    licenseData: licenseData[],
    guild: Guild,
    time: string
  ) {
    const prisma = new PrismaClient();
    const logs = await prisma.logs.findFirst({ where: { guildId: guild.id } });
    if (!logs) {
      prisma.$disconnect();
      return;
    }
    const logChannel = client.channels.cache.get(logs.channel);
    if (!logChannel) {
      prisma.$disconnect();
      return;
    }
    if (logs.activated === false) return prisma.$disconnect();
    if (logChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle("LOGS - License Created")
        .setDescription(
          `${
            licenseData.length <= 1
              ? "A license key has been created"
              : `${licenseData.length} license keys have been created`
          }\n\n${licenseData
            .map(
              (license) =>
                `- \`${license.key}\` -> ${parseMs(ms(time)).days} days, ${
                  parseMs(ms(time)).hours
                } hours, ${parseMs(ms(time)).minutes} minutes, ${
                  parseMs(ms(time)).seconds
                } seconds -> <@&${licenseData[0].role}>`
            )
            .join("\n")}`
        )
        .addFields([
          {
            name: "Author",
            value: `<@${licenseData[0].author}>`,
          },
        ])
        .setColor("#2f3136")
        .setTimestamp()
        .setFooter({ text: "Licensy v3 - Logs" });
      logChannel.send({ embeds: [embed] });
      prisma.$disconnect();
    }
  },
} satisfies any;
