require("dotenv").config();
require("module-alias/register");

// register extenders
require("@helpers/extenders/Message");
require("@helpers/extenders/Guild");
require("@helpers/extenders/GuildChannel");

const { checkForUpdates } = require("@helpers/BotUtils");
const { initializeMongoose } = require("@src/database/mongoose");
const { BotClient } = require("@src/structures");
const { validateConfiguration } = require("@helpers/Validator");

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

validateConfiguration();

// initialize client
const botClient = new BotClient();
botClient.loadCommands("src/commands");
botClient.loadContexts("src/contexts");
botClient.loadEvents("src/events");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// find unhandled promise rejections
process.on("unhandledRejection", (err) => botClient.logger.error(`Unhandled exception`, err));

(async () => {
  // check for updates
  await checkForUpdates();

  // start the dashboard
  if (botClient.config.DASHBOARD.enabled) {
    botClient.logger.log("Launching dashboard");
    try {
      const { launch } = require("@root/dashboard/app");

      // let the dashboard initialize the database
      await launch(botClient);
    } catch (ex) {
      botClient.logger.error("Failed to launch dashboard", ex);
    }
  } else {
    // initialize the database
    await initializeMongoose();
  }

  // start the client
  await botClient.login(process.env.BOT_TOKEN);
})();

// The ID of the "lobby" voice channel where users will join to create a VC
const LOBBY_CHANNEL_ID = '1315532642887794768';

// The ID of the category where new channels will be created
const CATEGORY_ID = '1315530062459699201';

// Store created channels to manage deletion
const createdChannels = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    // Check if the user joined the lobby channel
    if (newState.channelId === LOBBY_CHANNEL_ID && !oldState.channelId) {
        const guild = newState.guild;
        const member = newState.member;

        try {
            // Create a new voice channel in the specified category
            const newChannel = await guild.channels.create({
                name: `${member.user.username}'s Channel`,
                type: 2, // 2 is for voice channels
                parent: CATEGORY_ID, // Specify the category ID
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [PermissionsBitField.Flags.Connect],
                    },
                    {
                        id: member.id,
                        allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ManageChannels],
                    },
                ],
            });

            // Move the user to the new channel
            await member.voice.setChannel(newChannel);

            // Store the new channel
            createdChannels.set(member.id, newChannel.id);
        } catch (error) {
            console.error('Error creating voice channel:', error);
        }
    }

    // Check if the user left their created channel
    if (oldState.channelId && createdChannels.has(oldState.member.id)) {
        const createdChannelId = createdChannels.get(oldState.member.id);

        if (oldState.channelId === createdChannelId) {
            try {
                // Fetch the channel and delete it
                const channel = oldState.guild.channels.cache.get(createdChannelId);
                if (channel) await channel.delete();

                // Remove the channel from the map
                createdChannels.delete(oldState.member.id);
            } catch (error) {
                console.error('Error deleting voice channel:', error);
            }
        }
    }
});

// Log in to Discord
client.login(process.env.BOT_TOKEN);

