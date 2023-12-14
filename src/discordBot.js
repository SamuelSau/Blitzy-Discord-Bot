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
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
});

// Example in-memory structure for user inventories and bets, of course feel free to change to database if you want to permanently store the data
const userInventories = new Map(); // Store user inventory amounts
const userBets = new Map(); // Store user bets
const hasBetted = new Map();
let isBettingOpen = false;
let leagueGambleChannelId;

async function setUpChannel(){
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
		leagueGambleChannelId = existingChannel.id;
	} else {
		// Create the channel
		try {
			const channel =  guild.channels.create( {
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
	return leagueGambleChannelId;
}

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

		leagueGambleChannelId = await setUpChannel();
		await initializeUserInventories();

	});


	client.login(DISCORD_BOT_TOKEN);
}

export function bettingPeriod() {
    isBettingOpen = true;
    let remainingTime = 5; // Time in minutes

    const channel = client.channels.cache.get(leagueGambleChannelId);
    if (!channel) {
        console.error('Channel not found');
        return;
    }

    // Send the initial countdown message and store its ID
    channel.send(`Bush can Talk is now in a game\n\n Betting period has started!\n You have ${remainingTime} minutes to place your bets.`)
        .then((message) => {
            const countdownInterval = setInterval(() => {
                remainingTime--;
                if (remainingTime > 0) {
                    // Edit the message with the updated countdown
                    message.edit(`**You have ${remainingTime} minutes left to bet.**`);
                } else {
                    clearInterval(countdownInterval);
                    isBettingOpen = false;
                    // Final update to the message
                    message.edit('Betting period has ended.');
                }
            }, 60 * 1000); // 60 seconds
        });
}

async function fetchUserIdsFromChannel() {
    const channel = await client.channels.fetch(leagueGambleChannelId);
    if (!channel || !channel.isTextBased()) return [];

    const messages = await channel.messages.fetch({ limit: 100 });
    const userIds = [...messages.values()].map(message => message.author.id);
    return [...new Set(userIds)]; // Remove duplicates
}

async function initializeUserInventories() {
	const userIds = await fetchUserIdsFromChannel();
	userIds.forEach((userId) => {
		userInventories.set(userId, 5000); // Initialize with 5000 points
		hasBetted.set(userId, false);	 //Initialize false for all bets from all users
	});
}


export async function betMatch(interaction) {
	const team = interaction.options.getString('team');
	const amount = interaction.options.getInteger('amount');
	const userId = interaction.user.id;
	const guild = client.guilds.cache.get(GUILD_ID);
	let discordName = ''; // Initialize the variable in a broader scope

	if (guild){
		try {
			const member = await guild.members.fetch(userId); // Await the fetch
			discordName = member.user.username; // Set the variable
			console.log(`Discord name of the user: ${discordName}`);
		} catch (error) {
			console.error('Error fetching member:', error);
			// Handle error (e.g., member not found)
			return;
		}
	}

	if (!userInventories.has(userId) || userInventories.get(userId) < amount) {
		await interaction.reply({
			content: 'Insufficient credit to place this bet.',
			ephemeral: true,
		});
		return;
	}

	let didBet = hasBetted.get(userId);

	if (didBet === false){
		userBets.set(userId, { team, amount });
		userInventories.set(userId, userInventories.get(userId) - amount);
	
		await interaction.reply({
			content: `${discordName} has placed: ${amount} points on ${team} team.`,
		});
		hasBetted.set(userId, true);
		return;
	}

	else if (didBet === true){ //only be able to bet once each  game
		const bet = userBets.get(userId);
		await interaction.reply({
			content: `${discordName} has already betted ${bet.amount} points on ${bet.team} team. Can only bet once per game`,
			ephemeral: true,
		})
		return;
	}

	if (!isBettingOpen) {
		await interaction.reply({
			content: 'No betting during this time.',
			ephemeral: true,
		});
		return;
	}
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
	const announcement = `The match has ended. ${result} team is victorious!`;
	// Assuming you have a channel ID to send messages
	const channel = client.channels.cache.get(leagueGambleChannelId);
	// Reset the hasBetted status for all users
	hasBetted.forEach((value, key) => {
		hasBetted.set(key, false);
	});


	if (channel) {
		channel.send(announcement);
	}
}

export async function distributePoints(result) {
	userBets.forEach((bet, userId) => {
		if (bet.team === result) { //for the team that won
			// User won the bet
			const winnings = bet.amount * 2; // Example: double the bet amount
			const currentInventory = userInventories.get(userId) || 0;
			userInventories.set(userId, currentInventory + winnings);
		}
		else if (bet.team !== result){
			const losings = bet.amount * 2;
			const currentInventory = userInventories.get(userId) || 0;
			userInventories.set(userId, currentInventory - losings);
		}
	});

	announceBetResults(userBets);

	userBets.clear();
}

async function announceBetResults(userBets) {
    const channel = client.channels.cache.get(leagueGambleChannelId);
    const guild = client.guilds.cache.get(GUILD_ID);

    if (channel && guild) {
        let resultsMessage = 'Betting Results:\n\n';

        for (const [userId, bet] of userBets) {
            try {
                const member = await guild.members.fetch(userId);
                const discordName = member.user.username;
                resultsMessage += `${discordName} now currently has ${userInventories.get(userId)} points after betting on ${bet.team} with ${bet.amount} points.\n`;
            } catch (error) {
                console.error(`Error fetching member: ${error}`);
            }
        }

        channel.send(resultsMessage);
    }
}
