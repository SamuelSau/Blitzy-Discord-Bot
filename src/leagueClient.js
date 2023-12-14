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

	ws.subscribe('/lol-gameflow/v1/gameflow-phase', (data, event) => {
		if (data === 'GameStart') {
			bettingPeriod();
		}
	});

	ws.subscribe('/lol-end-of-game/v1/eog-stats-block', (data, event) => {
		const blueTeam = data['localPlayer']['teamId'];
		const hasWon = data['localPlayer']['stats']['WIN'];

		if (blueTeam === 100 && hasWon === 1 ) {
			annnounceResultAndDistributePoints('blue'); 
		} else {
			annnounceResultAndDistributePoints('red'); 
		}
	});

	process.on('SIGINT', () => {
		ws.close(); 
		process.exit(); 
	});
}


