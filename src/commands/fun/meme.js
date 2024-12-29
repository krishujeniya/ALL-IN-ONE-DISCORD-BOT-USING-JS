const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ApplicationCommandOptionType,
  ButtonStyle,
} = require("discord.js");
const { EMBED_COLORS } = require("@root/config.js");
const { getJson } = require("@helpers/HttpUtils");
const { getRandomInt } = require("@helpers/Utils");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "meme",
  description: "Get a random meme",
  category: "FUN",
  botPermissions: ["EmbedLinks"],
  cooldown: 20,
  command: {
    enabled: true,
    usage: "[category]",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "category",
        description: "Meme category",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
  },

  async messageRun(message, args) {
    const choice = args[0];

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("regenMemeBtn").setStyle(ButtonStyle.Secondary).setEmoji("🔁")
    );
    const embed = await getRandomEmbed(choice);

    const sentMsg = await message.safeReply({
      embeds: [embed],
      components: [buttonRow],
    });

    const collector = message.channel.createMessageComponentCollector({
      filter: (reactor) => reactor.user.id === message.author.id,
      time: this.cooldown * 1000,
      max: 3,
      dispose: true,
    });

    collector.on("collect", async (response) => {
      if (response.customId !== "regenMemeBtn") return;
      await response.deferUpdate();

      const embed = await getRandomEmbed(choice);
      await sentMsg.edit({
        embeds: [embed],
        components: [buttonRow],
      });
    });

    collector.on("end", () => {
      buttonRow.components.forEach((button) => button.setDisabled(true));
      return sentMsg.edit({
        components: [buttonRow],
      });
    });
  },

  async interactionRun(interaction) {
    const choice = interaction.options.getString("category");

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("regenMemeBtn").setStyle(ButtonStyle.Secondary).setEmoji("🔁")
    );
    const embed = await getRandomEmbed(choice);

    await interaction.followUp({
      embeds: [embed],
      components: [buttonRow],
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: (reactor) => reactor.user.id === interaction.user.id,
      time: this.cooldown * 1000,
      max: 3,
      dispose: true,
    });

    collector.on("collect", async (response) => {
      if (response.customId !== "regenMemeBtn") return;
      await response.deferUpdate();

      const embed = await getRandomEmbed(choice);
      await interaction.editReply({
        embeds: [embed],
        components: [buttonRow],
      });
    });

    collector.on("end", () => {
      buttonRow.components.forEach((button) => button.setDisabled(true));
      return interaction.editReply({
        components: [buttonRow],
      });
    });
  },
};

// Function to get a random meme using the meme-api.com
async function getRandomEmbed(choice) {
  const subreddits = ["memes", "dankmemes", "funny", "jokes"]; // List of available subreddits
  let rand = choice ? choice : subreddits[getRandomInt(subreddits.length)];

  // Fetch meme from meme-api.com using the chosen subreddit/category
  const response = await getJson(`https://meme-api.com/gimme/${rand}`);
  if (!response.success) {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.ERROR)
      .setDescription("Failed to fetch meme. Try again!");
  }

  const memeData = response.data; // Meme data structure from the API

  if (!memeData || !memeData.url) {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.ERROR)
      .setDescription(`No meme found matching ${choice}`);
  }

  try {
    const memeUrl = memeData.url;
    const memeTitle = memeData.title;
    const memeAuthor = memeData.author;
    const memePostLink = memeData.postLink; // This is the link to the Reddit post of the meme
    const memeUpvotes = memeData.ups;
    const memeNumComments = memeData.num_comments;

    // Creating embed to display the meme
    return new EmbedBuilder()
      .setAuthor({ name: memeTitle, url: memePostLink })
      .setImage(memeUrl)
      .setColor("#00ff00")
      .setFooter({ text: `👍 ${memeUpvotes} | 💬 ${memeNumComments}` });
  } catch (error) {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.ERROR)
      .setDescription("Failed to fetch meme. Try again!");
  }
}

