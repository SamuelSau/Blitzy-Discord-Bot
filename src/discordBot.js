import {
	Client,
	GatewayIntentBits,
	SlashCommandBuilder,
	REST,
	Routes,
} from 'discord.js';
import {} from 'dotenv/config';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// Example in-memory structure for user inventories and bets, of course feel free to change to database if you want to permanently store the data
const userInventories = new Map(); // Store user inventory amounts
const userBets = new Map(); // Store user bets
let isBettingOpen = false;
let leagueGambleChannelId;

export function startDiscordBot() {
	// Define Slash Commands
	const commands = [
		new SlashCommandBuilder()
			.setName('bet')
			.setDescription('Bet on a team')
			.addStringOption((option) =>
				option
					.setName('team')
					.setDescription('The team to bet on')
					.setRequired(true)
					.addChoices(
						{ name: 'Red', value: 'red' },
						{ name: 'Blue', value: 'blue' }
					)
			)
			.addIntegerOption((option) =>
				option
					.setName('amount')
					.setDescription('The amount to bet')
					.setRequired(true)
			),
		new SlashCommandBuilder()
			.setName('inventory')
			.setDescription('Check your inventory amount'),
	].map((command) => command.toJSON());

	const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

	(async () => {
		try {
			console.log('Started refreshing application (/) commands.');

			await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
				body: commands,
			});

			console.log('Successfully reloaded application (/) commands.');
		} catch (error) {
			console.error(error);
		}
	})();

	client.on('interactionCreate', async (interaction) => {
		if (!interaction.isCommand()) return;

		const { commandName } = interaction;

		if (commandName === 'bet') {
			await betMatch(interaction);
		} else if (commandName === 'inventory') {
			await checkInventoryAmount(interaction);
		}
	});

	client.on('ready', async () => {
		console.log(`Logged in as ${client.user.tag}!`);

		// Assuming the bot is part of one guild, or you know the specific guild ID
		const guild = client.guilds.cache.get(GUILD_ID); // or use client.guilds.cache.get('YOUR_GUILD_ID') for a specific guild
		const channelName = 'league-gamble';
		// Check if the channel already exists
		const existingChannel = guild.channels.cache.find(
			(ch) => ch.name === channelName && ch.type === 0
		);
		if (existingChannel) {
			console.log(
				`Channel already exists: ${existingChannel.name} with ID: ${existingChannel.id}`
			);
		} else {
			// Create the channel
			try {
				const channel = await guild.channels.create( {
					name: channelName,
					type: 0, // Make sure it's a text channel
					reason: 'Needed a dedicated channel for league gambling',
				});
				console.log(`Created channel: ${channel.name} with ID: ${channel.id}`);
				leagueGambleChannelId = channel.id;
			} catch (error) {
				console.error(`Error creating channel: ${error}`);
			}
		}

		// Example: Update points in a specific channel
		const userIds = await fetchUserIdsFromChannel();
		initializeUserInventories(userIds);

		setInterval(() => {
			userIds.forEach((userId) => {
				let currentPoints = userInventories.get(userId) || 0;
				userInventories.set(userId, currentPoints + 50); // Add 50 points every minute
			});
		}, 60000); // 60000 ms = 1 minute
	});

	client.login(DISCORD_BOT_TOKEN);
}

export function openBetting() {
	isBettingOpen = true;
	setTimeout(() => {
		isBettingOpen = false;
		// Announce in the Discord channel that betting is now closed
		const channel = client.channels.cache.get(leagueGambleChannelId);
		if (channel) {
			channel.send('Betting period has ended.');
		}
	}, 5 * 60 * 1000); // 5 minutes in milliseconds
}

async function fetchUserIdsFromChannel() {
	const channel = client.channels.cache.get(leagueGambleChannelId);
	if (!channel) return []; // Channel not found

	let allUserIDs = [];

	// Assuming this is a text channel in a guild
	if (channel.isTextBased()) {
		const messages = await channel.messages.fetch({ limit: 100 });
		messages.forEach((message) => {
			allUserIDs.push(message.author.id);
		});
	}

	return Array.from(new Set(allUserIDs)); // Remove duplicates
}

function initializeUserInventories(userIds) {
	userIds.forEach((userId) => {
		userInventories.set(userId, 5000); // Initialize with 5000 points
	});
}

export async function sendGameStateNotification(gameState) {
	const channel = client.channels.cache.get(leagueGambleChannelId);
	if (channel) {
		channel.send(`The current summoner is now in ${gameState}`);
	}
}

// bot will notify the users in that channel based on the functions bellow
export async function announceBetStart() {
	const channel = client.channels.cache.get(leagueGambleChannelId);
	if (channel) {
		channel.send(
			'Betting for the next match has started!\n\n Use /bet to place your bets.\n\nYou have 5 minutes for betting.'
		);
	}
}

export async function betMatch(interaction) {
	const team = interaction.options.getString('team');
	const amount = interaction.options.getInteger('amount');
	const userId = interaction.user.id;

	if (!isBettingOpen) {
		await interaction.reply({
			content: 'Betting period has ended for this game.',
			ephemeral: true,
		});
		return;
	}

	if (!userInventories.has(userId) || userInventories.get(userId) < amount) {
		await interaction.reply({
			content: 'Insufficient credit to place this bet.',
			ephemeral: true,
		});
		return;
	}

	userBets.set(userId, { team, amount });
	userInventories.set(userId, userInventories.get(userId) - amount);

	await interaction.reply({
		content: `Bet placed: ${amount} points on ${team} team.`,
		ephemeral: true,
	});
}

export async function checkInventoryAmount(interaction) {
	const userId = interaction.user.id;
	const inventoryAmount = userInventories.get(userId) || 0;

	await interaction.reply({
		content: `You have ${inventoryAmount} points in your inventory.`,
		ephemeral: true,
	});
}

export async function announceMatchResult(result) {
	// 'result' should be either 'red' or 'blue'
	// Announce the result in the channel
	// This function needs to be called from leagueClient.js with the result of the match
	const announcement = `The match has ended. ${result} team is victorious!`;
	// Assuming you have a channel ID to send messages
	const channel = client.channels.cache.get(leagueGambleChannelId);
	if (channel) {
		channel.send(announcement);
	}
}

export async function distributePoints(result) {
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
	const channel = client.channels.cache.get(leagueGambleChannelId);
	if (channel) {
		channel.send('Points have been distributed to the winners.');
	}
}
