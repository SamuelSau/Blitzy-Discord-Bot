import {
	createWebSocketConnection,
} from 'league-connect';

import {
	bettingPeriod,
	annnounceResultAndDistributePoints,
	announceGameStart
} from './discordBot.js';

import fs from 'fs';

export async function startLeagueClient() {

	const ws = await createWebSocketConnection({
		authenticationOptions: {
		  awaitConnection: true
		},
		pollInterval: 1000,
		maxRetries: 10
	  })

	let nameOfSummoner = "Bush can talk";
	let hasAnnouncedResults = false;
	
	ws.subscribe('/lol-gameflow/v1/session', async (data) => {
		let gamePhase = data['phase'];
		let gameMode = data['map']['gameMode']
		let mapName = data['map']['name'];
		let blueTeam = data['gameData']['teamOne'];
		let redTeam = data['gameData']['teamTwo'];
		let championId = 0;
		let championName = '';
		let summonersOfBlueTeam = [];
		let summonersOfRedTeam = [];

		if (gamePhase === 'Lobby' || gamePhase == 'ChampSelect'){
			hasAnnouncedResults = false;
		}

		if (gamePhase === 'GameStart')
		{
			
			for (let bluePlayer of blueTeam)
			{	
				championId = bluePlayer['championId']
				championName = await getChampionNameById(String(championId))
				summonersOfBlueTeam.push({
					summonerName: bluePlayer['summonerName'], 
					championName: championName
				});
			}

			for (let redPlayer of redTeam)
			{

				championId = redPlayer['championId']
				championName = await getChampionNameById(String(championId));
				summonersOfRedTeam.push({
					summonerName: redPlayer['summonerName'], 
					championName: championName
				});
			}
			announceGameStart(nameOfSummoner, gameMode, mapName, summonersOfBlueTeam, summonersOfRedTeam);
			bettingPeriod();
		}
		
	});


	ws.subscribe('/lol-end-of-game/v1/eog-stats-block', (data) => { //grab if i am on the winning team
		
		if (hasAnnouncedResults === true){
			return;
		}

		let summonerTeamColor = null;
		let result = null;

		// Assuming 'data' is the parsed JSON object
		for (let team of data.teams) {
			for (let player of team.players) {
				if (player.summonerName === nameOfSummoner) {
					summonerTeamColor = team.teamId === 100 ? 'Blue' : 'Red';
					result = team.isWinningTeam ? 'won' : 'lost';
					break;
				}
			}
			if (summonerTeamColor !== null) break;
		}

		if (result !== null && summonerTeamColor !== null) {
			annnounceResultAndDistributePoints(summonerTeamColor, result);
			hasAnnouncedResults = true;
		}
		
	});

	process.on('SIGINT', () => {
		ws.close(); 
		process.exit(); 
	});
}


// Function to read and parse a JSON file
function loadJSON(filename = '') {
    // Read the file contents
    const contents = fs.readFileSync(filename, 'utf-8');

    // Parse and return the JSON
    return JSON.parse(contents);
}

function getChampionNameById(championId) {
    try {
        const championData = loadJSON('./champion.json'); // Load the champion data
		let champion;

		for (const championKey in championData.data) {
			champion = championData.data[championKey];
			// Compare the champion key with the passed championId
			if (champion['key'] == String(championId)) {
				return champion['name']; // Return the champion name
			}
		}
		console.log("Champion not found"); // Return a default message if not found
		return '';
    } catch (error) {
        console.error('Error in getChampionNameById:', error);
        return ''; // Return empty string or handle as necessary
    }
}



