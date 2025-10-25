import {
  EmbedBuilder,
  Guild,
  GuildMember,
  Locale,
  TextChannel,
} from "discord.js";
import { ExtendedClient } from "../../structures/client.js";
import type { Event } from "../../structures/event.js";
import { licenseData } from "../../types/licenseData.js";

export default {
  name: "licenseStopped",
  once: false,
  async execute(
    client: ExtendedClient,
    licenseData: licenseData,
    guild: Guild,
    member: GuildMember,
    author: GuildMember,
    localeCached: Locale
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
      const time = `${new Date(Number(licenseData.validUntil))
        .getDate()
        .toLocaleString(localeCached)}/${new Date(
        Number(licenseData.validUntil)
      )
        .getMonth()
        .toLocaleString(localeCached)}/${new Date(
        Number(licenseData.validUntil)
      )
        .getFullYear()
        .toLocaleString(localeCached)} ${new Date(
        Number(licenseData.validUntil)
      )
        .getHours()
        .toLocaleString(localeCached)}:${new Date(
        Number(licenseData.validUntil)
      )
        .getMinutes()
        .toLocaleString(localeCached)}:${new Date(
        Number(licenseData.validUntil)
      )
        .getSeconds()
        .toLocaleString(localeCached)}`;
      const embed = new EmbedBuilder()
        .setTitle("LOGS - License Stopped")
        .setDescription(`A license key has been stopped for <@${member.id}>.`)
        .addFields([
          {
            name: "Author",
            value: `<@${author.id}>`,
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
            name: "License meant to expire at",
            value: `${time}`,
          },
        ])
        .setColor("#2f3136")
        .setTimestamp()
        .setFooter({ text: "Licensy - Logs" });
      if (logChannel instanceof TextChannel) {
        logChannel.send({ embeds: [embed] });
      }
      prisma.$disconnect();
    }
  },
} satisfies Event<"licenseStopped">;
