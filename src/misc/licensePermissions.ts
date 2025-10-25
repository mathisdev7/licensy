import { MessageFlags, PermissionsBitField } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

/**
 * Ensures the invoking member can manage licenses or templates by checking administrator
 * permission or configured manager roles. Replies with an ephemeral error when not allowed.
 */
export async function ensureCanManageLicenses(
  interaction: ChatInputCommandInteraction<"cached">
): Promise<boolean> {
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
    prisma.$disconnect();
    await interaction.reply({
      content:
        "You must be an administrator or have a configured role to manage license templates.",
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (!hasAdminPermission && managerRoles.length === 0) {
    prisma.$disconnect();
    await interaction.reply({
      content:
        "Only administrators can manage license templates until roles are configured.",
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}
