// const {connectMongoDB} = require('./mongodbClient');
import { connectMongoDB } from './mongoDBConnection.js';
import {createGifEmbeddings} from './gifEmbeddings.js';
import cron from 'node-cron';
import {
	Client,
	GatewayIntentBits,
	SlashCommandBuilder,
	REST,
	Routes,
	Colors 
} from 'discord.js';
import {} from 'dotenv/config';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID_OASIS;

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], 
});

let isBettingOpen = false;
let leagueGambleChannelId;
let guild;
let channel;
const channelName = 'league-gambling'
let db;
let summonerName = '';

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

export async function startDiscordBot() {

	db = await connectMongoDB();

	// Define Slash Commands
	const commands = [
		new SlashCommandBuilder()
			.setName('bet')
			.setDescription('Bet on a team')
			.addStringOption(option =>
				option.setName('outcome')
					.setDescription('The outcome to bet on')
					.setRequired(true)
					.addChoices(
						{ name: 'Win', value: 'win' },
						{ name: 'Lose', value: 'lose' }
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
			
		new SlashCommandBuilder()
			.setName('leaderboard')
			.setDescription('Check leaderboard status on betting player will most points')

	].map((command) => command.toJSON());


	const rest = new REST().setToken(DISCORD_BOT_TOKEN);

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
		else if (commandName === 'leaderboard'){
			await fetchLeaderboard(interaction);
		}

	});


	client.on('ready', async () => {
		console.log(`Logged in as ${client.user.tag}!`);

		leagueGambleChannelId = await setUpChannel();
		channel = client.channels.cache.get(leagueGambleChannelId);

	});

	client.login(DISCORD_BOT_TOKEN).then(() => {
		// client.user is now defined
		client.user.setPresence({
			status: 'online',
		});
		client.user.setActivity('Hosting degenerate gambling 😎', { type: 4 });
	   });
	  
}
async function fetchUserName(userId) {
    try {
        // Attempt to retrieve the user from the client's cache
        let user = client.users.cache.get(userId);

        // If the user is not in cache, fetch them from the Discord API
        if (!user) {
            user = await client.users.fetch(userId);
        }

        // Return the user's username
        return user.username;
    } catch (error) {
        console.error('Error fetching user:', error);
        return "Unknown User"; // or however you'd like to handle this
    }
}

async function fetchLeaderboard(interaction) {
    try {
        const inventoryCollection = db.collection('userInventories');
        const rankedLeaderboard = await inventoryCollection.find({}).sort({ balance: -1 }).toArray();
        let message = "🏆 **Leaderboard** 🏆\n\n";

        // Loop through each user in the leaderboard
        for (const [index, user] of rankedLeaderboard.entries()) {
            try {
                const discordName = await fetchUserName(user.userId);  // Use the ID from each leaderboard user
                message += `**${index + 1}. ${discordName}** ${user.balance} points\n`;
            } catch (error) {
                console.error(`Failed to fetch username for user ID: ${user.userId}`, error);
                // Handle the error appropriately
                message += `**${index + 1}. Unknown User**: ${user.balance} points\n`;
            }
        }

        await interaction.reply(message);
    } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
        interaction.reply("Failed to fetch the leaderboard. Please try again later.");
    }
}


export async function announceGameStart(nameOfSummoner, gameMode, mapName, summonersOfBlueTeam, summonersOfRedTeam){
	let teamMessage = "";
	teamMessage += `Game Mode: ${gameMode}\nMap: ${mapName}\n\n`;
	if(channel && guild){

		teamMessage += '***Blue Team:***\n\n';

		for (let player of summonersOfBlueTeam){
			if(player.summonerName === nameOfSummoner){
				teamMessage += `**${player.championName} (${nameOfSummoner})**\n`;
				summonerName = nameOfSummoner;
			}
			else{
				teamMessage += `${player.championName} (${player.summonerName})\n`;
			}
		}
		teamMessage += '\n'
		teamMessage += '***Red Team:***\n\n';

		for (let player of summonersOfRedTeam){
			if(player.summonerName === nameOfSummoner){
				teamMessage += `**${player.championName} (${nameOfSummoner})**\n`;
				summonerName = nameOfSummoner;
			}
			else{	
				teamMessage += `${player.championName} (${player.summonerName})\n`;
				}
		}
		teamMessage += '\n\n'
		channel.send(teamMessage);
	}
}

export function bettingPeriod() {
    isBettingOpen = true;
    let remainingTime = 3; // Time in minutes

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
    channel.send(`\n\n*Betting period has started!*\n\nBetting starts: ${startTimeFormatted}\nBetting ends: ${endTimeFormatted}\n\n`)
        .then((message) => {
            const countdownInterval = setInterval(() => {
                remainingTime--;
                if (remainingTime > 0) {
                    // Edit the message with the updated countdown
                    message.edit(`\n\nBetting period has started!\n\nBetting starts: ${startTimeFormatted}\nBetting ends: ${endTimeFormatted}\n\n**You have ${remainingTime} minutes left to bet.**`);
                } else {
                    clearInterval(countdownInterval);
                    isBettingOpen = false;
                    // Final update to the message
                    message.edit(`**Betting period has ended at ${endTimeFormatted}**`);
                }
            }, 60 * 1000); // 60 seconds
        });
}

export async function betMatch(interaction) {

	if (!isBettingOpen) {
		await interaction.reply({
			content: 'No betting during this time.',
			ephemeral: true
		});
		return;
	}

	const outcome = interaction.options.getString('outcome');	
	const amount = interaction.options.getInteger('amount');
	const userId = interaction.user.id;

	// Fetch or initialize user inventory
    const inventoryCollection = db.collection('userInventories');
    let inventory = await inventoryCollection.findOne({ userId });

    if (!inventory) {
        // User does not exist in the database, initialize with 5000 points
        await inventoryCollection.insertOne({ userId, balance: 50000 });
        inventory = { balance: 5000 };
    }

	if (inventory.balance < amount) {
		await interaction.reply({
			content: 'Insufficient amount of points to place this bet.',
			ephemeral: true,
		});
		return;
	}

	//check for negative bets
	if (amount <= 0){
		await interaction.reply({
			content: 'Cannot bet 0 or negative points',
			ephemeral: true,
		});
		return;
	}

	// Check if user has already placed a bet
	const betsCollection = db.collection('userBets');
	const existingBet = await betsCollection.findOne({ userId });

	if (existingBet) {
		await interaction.reply({
			content: 'You have already placed a bet. You can only bet once per game.',
			ephermal: true
		});
		return;
	}


	// Place a new bet and update user inventory
	await betsCollection.insertOne({ userId, outcome, amount });
	await inventoryCollection.updateOne(
		{ userId },
		{ $inc: { balance: -amount } }
	);


	await interaction.reply(`Bet placed: ${amount} points you predicted that ${summonerName} will ${outcome}`);

	}


export async function annnounceResultAndDistributePoints(summonerTeamColor, gameResult) {
	const betsCollection = db.collection('userBets');
    const inventoryCollection = db.collection('userInventories');
	let discordName = ''; 
	let member = '';
	let roles = '';
    const bets = await betsCollection.find().toArray();
    let resultsMessage = 'Betting Results:\n\n';

	if (channel && guild){
		for (const bet of bets) {

			member = await guild.members.fetch(bet.userId); // Await the fetch
			discordName = member.user.username; // Set the variable
			roles = await guild.roles.fetch();
		
			// Determine if the user won or lost their bet
			let betResult = 0; // Initialize betResult to 0
			if ((gameResult === 'won' && bet.outcome === 'win') || (gameResult === 'lost' && bet.outcome === 'lose')) {
				// User correctly predicted the outcome
				betResult = bet.amount * 2; // Double their bet
			}

			await inventoryCollection.updateOne(
                { userId: bet.userId },
                { $inc: { balance: betResult } }
            );

			const updatedInventory = await inventoryCollection.findOne({ userId: bet.userId });
			const currentMilestone = updatedInventory.highestMilestone; 
			const newMilestone = checkMilestone(updatedInventory.balance, updatedInventory.highestMilestone);

            if (newMilestone && currentMilestone !== newMilestone) {
                // Announce the new milestone
                channel.send(`${discordName} has reached ${newMilestone} with ${updatedInventory.balance} points! Congratulations!`);
                // Update the user's highest milestone
                await inventoryCollection.updateOne({ userId: bet.userId }, { $set: { highestMilestone: newMilestone } });
				await assignTierRole(member, newMilestone, roles);

            }

            resultsMessage += `${discordName} now currently has ${updatedInventory.balance} points.\n`;
        }
		
		const announcement = `The match has ended.\n\n${summonerName} was on ${summonerTeamColor} team and **${gameResult.toUpperCase()}** the game!`;
		
		channel.send(announcement);
		channel.send(resultsMessage);
		createGifEmbeddings(gameResult, channel);
		await betsCollection.deleteMany({});
	}
}

export async function checkInventoryAmount(interaction) {
	const userId = interaction.user.id;
    const inventoryCollection = db.collection('userInventories');
    const inventory = await inventoryCollection.findOne({ userId }) || { balance: 0 };

    await interaction.reply({
        content: `You have ${inventory.balance} points in your inventory.`,
        ephermal: true
    });
}

// Function to add daily points
async function addDailyPoints() {
    const inventoryCollection = db.collection('userInventories');
    await inventoryCollection.updateMany({}, { $inc: { balance: 5000 } });
    console.log('Added daily points to all users');
	channel.send(`Everyone received their daily 5000 points`);
}

// Schedule the task to run at 9:00 PM every day
cron.schedule('0 21 * * *', () => {
    addDailyPoints();
}, {
    scheduled: true,
    timezone: "America/New_York" // Replace with your timezone
});

function checkMilestone(balance, currentMilestone) {
    const milestones = [
        [1000000000, 'Challenger'],
        [100000000, 'Grandmasters'],
        [10000000, 'Masters'],
        [1000000, 'Diamond'],
        [500000, 'Emerald'],
        [100000, 'Platinum'],
        [50000, 'Gold'],
        [20000, 'Silver'],
        [10000, 'Bronze'],
        [5000, 'Iron'],
    ]; // Sorted by points descending

    for (const [points, tier] of milestones) {
        if (balance >= points) {
            // If balance is greater than or equal to the required points,
            // and either there is no current milestone or the tier is higher than the current
            if (!currentMilestone || milestones.findIndex(([_pts, _tier]) => _tier === tier) < milestones.findIndex(([_pts, _tier]) => _tier === currentMilestone)) {
                return tier;
            }
            break; // Once you've found where the user fits in the milestone list, you don't need to keep checking lower milestones.
        }
    }
    return currentMilestone; // Return the current milestone if no new milestone has been reached
}


async function assignTierRole(member, tier, roles) {
    // Find the role corresponding to the tier in the server
	console.log(roles)
	let tierRole = guild.roles.cache.find(r => r.name === tier)
	console.log(tierRole)
    if (tierRole) {
        try {
            // Assign the role to the member
            await member.roles.add(tierRole);
            console.log(`Assigned ${tier} role to ${member.user.username}`);
        } catch (error) {
            console.error(`Failed to assign role: ${error}`);
        }
    } else {
        console.log(`Role ${tier} not found in guild!`);
    }
}