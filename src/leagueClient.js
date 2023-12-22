import {
	createWebSocketConnection,
} from 'league-connect';

import {
	bettingPeriod,
	annnounceResultAndDistributePoints
} from './discordBot.js';

export async function startLeagueClient() {

	const ws = await createWebSocketConnection({
		authenticationOptions: {
			awaitConnection: true,
		},
	});

	ws.subscribe('/lol-gameflow/v1/gameflow-phase', (data) => {
		if (data === 'GameStart') {
			bettingPeriod();
		}

	});

	ws.subscribe('/lol-end-of-game/v1/eog-stats-block', (data) => { //grab if i am on the winning team
		
		let summonerName = 'Bush can talk';
		let summonerTeamColor = null;
		let result = null;
		
		// Assuming 'data' is the parsed JSON object
		for (let team of data.teams) {
			for (let player of team.players) {
				if (player.summonerName === summonerName) {
					summonerTeamColor = team.teamId === 100 ? 'Blue' : 'Red';
					result = team.isWinningTeam ? 'won' : 'lost';
					break;
				}
			}
			if (summonerTeamColor !== null) break;
		}

		if (summonerTeamColor !== null) {
			console.log(`Summoner ${summonerName} was on the ${summonerTeamColor} team and they ${result} the game.`);
		} else {
			console.log(`Summoner ${summonerName} not found in the game.`);
		}

		annnounceResultAndDistributePoints(summonerName, summonerTeamColor, result); 

	});

	process.on('SIGINT', () => {
		ws.close(); 
		process.exit(); 
	});
}


