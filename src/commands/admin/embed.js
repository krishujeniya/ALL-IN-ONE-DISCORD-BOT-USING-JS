const {
  ApplicationCommandOptionType,
  ChannelType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} = require("discord.js");
const { isValidColor, isHex } = require("@helpers/Utils");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "embed",
  description: "send embed message",
  category: "ADMIN",
  userPermissions: ["ManageMessages"],
  command: {
    enabled: true,
    usage: "<#channel>",
    minArgsCount: 1,
    aliases: ["say"],
  },
  slashCommand: {
    enabled: true,
    ephemeral: true,
    options: [
      {
        name: "channel",
        description: "channel to send embed",
        type: ApplicationCommandOptionType.Channel,
        channelTypes: [ChannelType.GuildText],
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!channel) return message.reply("Please provide a valid channel");
    if (channel.type !== ChannelType.GuildText) return message.reply("Please provide a valid text channel");
    if (!channel.canSendEmbeds()) {
      return message.reply("I don't have permission to send embeds in that channel");
    }
    message.reply(`Embed setup started in ${channel}`);
    await embedSetup(channel, message.member);
  },

  async interactionRun(interaction) {
    const channel = interaction.options.getChannel("channel");
    if (!channel.canSendEmbeds()) {
      return interaction.followUp("I don't have permission to send embeds in that channel");
    }
    interaction.followUp(`Embed setup started in ${channel}`);
    await embedSetup(channel, interaction.member);
  },
};

/**
 * @param {import('discord.js').GuildTextBasedChannel} channel
 * @param {import('discord.js').GuildMember} member
 */
async function embedSetup(channel, member) {
  const sentMsg = await channel.send({
    content: "Click the button below to get started",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("EMBED_ADD").setLabel("Create Embed").setStyle(ButtonStyle.Primary)
      ),
    ],
  });

  const btnInteraction = await channel
    .awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.customId === "EMBED_ADD" && i.member.id === member.id && i.message.id === sentMsg.id,
      time: 20000,
    })
    .catch(() => {});

  if (!btnInteraction) return sentMsg.edit({ content: "No response received", components: [] });

  await btnInteraction.showModal(
    new ModalBuilder({
      customId: "EMBED_MODAL",
      title: "Embed Generator",
      components: [
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("title")
            .setLabel("Embed Title")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("description")
            .setLabel("Embed Description")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("color")
            .setLabel("Embed Color")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("footer")
            .setLabel("Embed Footer")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("image")
            .setLabel("Image Link (Optional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
      ],
    })
  );

  const modal = await btnInteraction
    .awaitModalSubmit({
      time: 60000,
      filter: (m) => m.customId === "EMBED_MODAL" && m.member.id === member.id && m.message.id === sentMsg.id,
    })
    .catch(() => {});

  if (!modal) return sentMsg.edit({ content: "No response received, cancelling setup", components: [] });

  modal.reply({ content: "Embed sent", ephemeral: true }).catch(() => {});

  const title = modal.fields.getTextInputValue("title");
  const description = modal.fields.getTextInputValue("description");
  const footer = modal.fields.getTextInputValue("footer");
  const color = modal.fields.getTextInputValue("color");
  const image = modal.fields.getTextInputValue("image");

  if (!title && !description && !footer && !image)
    return sentMsg.edit({ content: "You can't send an empty embed!", components: [] });

  const embed = new EmbedBuilder();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (footer) embed.setFooter({ text: footer });
  if ((color && isValidColor(color)) || (color && isHex(color))) embed.setColor(color);
  if (image && image.startsWith("http")) {
    embed.setImage(image);
  } else if (image) {
    sentMsg.edit({ content: "Invalid image URL provided. Skipping the image.", components: [] });
  }

  await sentMsg.edit({
    content: "Embed created successfully!",
    embeds: [embed],
    components: [],
  });
}

