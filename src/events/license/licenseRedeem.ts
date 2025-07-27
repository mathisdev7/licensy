import { PrismaClient } from "@prisma/client";
import { EmbedBuilder, Guild, GuildMember } from "discord.js";
import { licenseData } from "../../types/licenseData.js";

export default {
  name: "licenseRedeem" as any,
  once: false,
  async execute(
    client: any,
    licenseData: licenseData,
    guild: Guild,
    time: string,
    member: GuildMember
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
        .setTitle("LOGS - License Redeemed")
        .setDescription(`A license key has been redeemed by <@${member.id}>.`)
        .addFields([
          {
            name: "Author",
            value: `<@${member.id}>`,
          },
          {
            name: "License key",
            value: `${licenseData.key}`,
          },
          {
            name: "License created by",
            value: `<@${licenseData.author}>`,
          },
          {
            name: "License valid until",
            value: `${time}`,
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
