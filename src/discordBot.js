import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import {} from 'dotenv/config'
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Example in-memory structure for user inventories and bets, of course feel free to change to database if you want to permanently store the data
const userInventories = new Map(); // Store user inventory amounts
const userBets = new Map(); // Store user bets

export function startDiscordBot() {

	    // Define Slash Commands
		const commands = [
			new SlashCommandBuilder()
				.setName('bet')
				.setDescription('Bet on a team')
				.addStringOption(option =>
					option.setName('team')
						.setDescription('The team to bet on')
						.setRequired(true)
						.addChoices({ name: 'Red', value: 'red' }, { name: 'Blue', value: 'blue' }))
				.addIntegerOption(option =>
					option.setName('amount')
						.setDescription('The amount to bet')
						.setRequired(true)),
			new SlashCommandBuilder()
				.setName('inventory')
				.setDescription('Check your inventory amount'),
		].map(command => command.toJSON());
	
		const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
	
		(async () => {
			try {
				console.log('Started refreshing application (/) commands.');
	
				await rest.put(
					Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
					{ body: commands },
				);
	
				console.log('Successfully reloaded application (/) commands.');
			} catch (error) {
				console.error(error);
			}
		})();
	
		client.on('interactionCreate', async interaction => {
			if (!interaction.isCommand()) return;
	
			const { commandName } = interaction;
	
			if (commandName === 'bet') {
				await betMatch(interaction);
			} else if (commandName === 'inventory') {
				await checkInventoryAmount(interaction);
			}
		});


	client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
      });

	client.login(DISCORD_BOT_TOKEN);
}

// bot will notify the users in that channel based on the functions bellow

async function announceBetStart() {
	const channelId = "YOUR_CHANNEL_ID";
	const channel = client.channels.cache.get(channelId);
	if (channel) {
		channel.send('Betting for the next match has started! Use /bet to place your bets.');
	}
}

async function betMatch(interaction) {
    const team = interaction.options.getString('team');
    const amount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;

    if (!userInventories.has(userId) || userInventories.get(userId) < amount) {
        await interaction.reply({ content: 'Insufficient credit to place this bet.', ephemeral: true });
        return;
    }

    userBets.set(userId, { team, amount });
    userInventories.set(userId, userInventories.get(userId) - amount);

    await interaction.reply({ content: `Bet placed: ${amount} points on ${team} team.`, ephemeral: true });
}


async function checkInventoryAmount(interaction) {
    const userId = interaction.user.id;
    const inventoryAmount = userInventories.get(userId) || 0;

    await interaction.reply({ content: `You have ${inventoryAmount} points in your inventory.`, ephemeral: true });
}


export function announceMatchResult(result) {
    // 'result' should be either 'red' or 'blue'
    // Announce the result in the channel
    // This function needs to be called from leagueClient.js with the result of the match
    const announcement = `The match has ended. ${result} team is victorious!`;
    // Assuming you have a channel ID to send messages
    const channelId = "YOUR_CHANNEL_ID";
    const channel = client.channels.cache.get(channelId);
    if (channel) {
        channel.send(announcement);
    }
}

export function distributePoints(result) {
    // 'result' should be either 'red' or 'blue'
    userBets.forEach((bet, userId) => {
        if (bet.team === result) {
            // User won the bet
            const winnings = bet.amount * 2; // Example: double the bet amount
            const currentInventory = userInventories.get(userId) || 0;
            userInventories.set(userId, currentInventory + winnings);
        }
    });

    // Clear all bets after distributing points
    userBets.clear();

    // Announce the distribution of points in the channel
    const channelId = "YOUR_CHANNEL_ID";
    const channel = client.channels.cache.get(channelId);
    if (channel) {
        channel.send('Points have been distributed to the winners.');
    }
}
