import { EmbedBuilder, Guild, GuildMember, TextChannel } from "discord.js";
import { ExtendedClient } from "../../structures/client.js";
import type { Event } from "../../structures/event.js";
import { licenseData } from "../../types/licenseData.js";

export default {
  name: "licenseRedeem",
  once: false,
  async execute(
    client: ExtendedClient,
    licenseData: licenseData,
    guild: Guild,
    time: string,
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
        .setFooter({ text: "Licensy - Logs" });
      if (logChannel instanceof TextChannel) {
        logChannel.send({ embeds: [embed] });
      }
      prisma.$disconnect();
    }
  },
} satisfies Event<"licenseRedeem">;
