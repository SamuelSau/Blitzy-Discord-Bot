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
const userInventories = new Map(); 
const userBets = new Map(); 
const hasBetted = new Map();
let isBettingOpen = false;
let leagueGambleChannelId;
let guild;
let channel;
const channelName = 'league-gambling'

 async function setUpChannel(){
	guild = client.guilds.cache.get(GUILD_ID);

	const existingChannel = guild.channels.cache.find(
		(ch) => ch.name === channelName && ch.type === 0
	);
	if (existingChannel) {
		leagueGambleChannelId = existingChannel.id;
	} else {
		try {
			channel = await guild.channels.create( {
				name: channelName,
				type: 0, // Make sure it's a text channel
			});
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
		channel = client.channels.cache.get(leagueGambleChannelId);

	});


	client.login(DISCORD_BOT_TOKEN);
}

export function bettingPeriod() {
    isBettingOpen = true;
    let remainingTime = 5; // Time in minutes

    if (!channel) {
        console.error('Channel not found');
        return;
    }

	const startTime = new Date(); // Current time
    const endTime = new Date(startTime.getTime() + remainingTime * 60 * 1000); // Add 5 minutes

    // Format time for display
    const startTimeFormatted = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const endTimeFormatted = endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Send the initial countdown message
    channel.send(`Bush can Talk is now in a game.\n\nBetting period has started!\n\nBetting starts: ${startTimeFormatted}\nBetting ends: ${endTimeFormatted}\n\n`)
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


export async function betMatch(interaction) {
	const team = interaction.options.getString('team');
	const amount = interaction.options.getInteger('amount');
	const userId = interaction.user.id;
	const guild = client.guilds.cache.get(GUILD_ID);
	let discordName = ''; 

	// Initialize for first-time users that use bet command
    if (!userInventories.has(userId)) {
        userInventories.set(userId, 5000); 
        hasBetted.set(userId, false);
    }

	if (guild){
		try {
			const member = await guild.members.fetch(userId); // Await the fetch
			discordName = member.user.username; // Set the variable
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


export async function annnounceResultAndDistributePoints(result) {
	userBets.forEach((bet, userId) => {
		if (bet.team === result) { //for the team that won

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

	const announcement = `The match has ended. ${result.toUpperCase()} team is victorious!`;

	hasBetted.forEach((value, key) => {
		hasBetted.set(key, false);
	});


	if (channel) {
		channel.send(announcement);
	}

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

	userBets.clear();
}

export async function checkInventoryAmount(interaction) {
	const userId = interaction.user.id;
	const inventoryAmount = userInventories.get(userId) || 0;

	await interaction.reply({
		content: `You have ${inventoryAmount} points in your inventory.`,
		ephemeral: true,
	});
}