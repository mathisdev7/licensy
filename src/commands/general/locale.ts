import {
  ApplicationCommandOptionType,
  RESTJSONErrorCodes,
  type ChatInputCommandInteraction,
} from "discord.js";

export default {
  data: {
    name: "set-locale",
    description: "Set the locale for the server.",
    options: [
      {
        name: "locale",
        description: "The locale to set.",
        choices: [
          { name: "English (US)", value: "en-US" },
          { name: "English (UK)", value: "en-GB" },
          { name: "Spanish (Spain)", value: "es-ES" },
          { name: "French (France)", value: "fr-FR" },
          { name: "German (Germany)", value: "de-DE" },
          { name: "Italian (Italy)", value: "it-IT" },
          { name: "Japanese", value: "ja" },
          { name: "Korean", value: "ko" },
          { name: "Portuguese (Portugal)", value: "pt-PT" },
          { name: "Portuguese (Brazil)", value: "pt-BR" },
          { name: "Russian", value: "ru-RU" },
          { name: "Chinese (Simplified)", value: "zh-CN" },
          { name: "Chinese (Traditional)", value: "zh-TW" },
        ],
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  opt: {
    userPermissions: ["Administrator"],
    botPermissions: ["SendMessages"],
    category: "General",
    cooldown: 5,
  },
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    try {
      const locale = interaction.options.getString("locale", true);
      const prisma = interaction.client.prisma;
      const currentLocale = await prisma.locale.findFirst({
        where: { guildId: interaction.guildId },
      });
      if (!currentLocale) {
        await prisma.locale.create({
          data: {
            guildId: interaction.guildId,
            locale,
          },
        });
        interaction.reply({
          content: `The locale has been set to \`${locale}\`.`,
          ephemeral: true,
        });
        return;
      }
      if (currentLocale.locale === locale) {
        return interaction.reply({
          content: `The locale is already set to \`${locale}\`.`,
          ephemeral: true,
        });
      }
      await prisma.locale.update({
        where: { id: currentLocale.id },
        data: { locale },
      });
      await interaction.reply({
        content: `The locale has been set to \`${locale}\`.`,
        ephemeral: true,
      });
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownMessage) {
        console.error(`Failed to edit interaction: ${error.message}`);
      }
    }
  },
} satisfies any;
