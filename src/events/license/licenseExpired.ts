import { EmbedBuilder, Guild, GuildMember } from "discord.js";
import { licenseData } from "../../types/licenseData.js";

export default {
  name: "licenseExpired",
  once: false,
  async execute(
    client: any,
    licenseData: licenseData,
    guild: Guild,
    member: GuildMember
  ) {
    const prisma = client.prisma;
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
        .setTitle("LOGS - License Expired")
        .setDescription(`A license key has expired.`)
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
            name: "Member",
            value: `<@${member.id}>`,
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
