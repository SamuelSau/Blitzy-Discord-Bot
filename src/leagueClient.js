import {
	authenticate,
	createWebSocketConnection,
	LeagueClient,
} from 'league-connect';

import {
	announceBetStart,
	announceMatchResult,
	distributePoints,
	sendGameStateNotification,
  openBetting,
} from './discordBot.js';

export async function startLeagueClient() {
	// ... all the logic for starting, handling, and monitoring the League client ...
	// 1. Authenticate to get credentials
	const credentials = await authenticate({
		awaitConnection: true,
		pollInterval: 5000, //ms? -> 5 seconds
	});

	// 2. Establish a WebSocket connection
	const ws = await createWebSocketConnection({
		authenticationOptions: {
			awaitConnection: true,
		},
	});

  
	//track down the gameflow phase
	ws.subscribe('/lol-gameflow/v1/gameflow-phase', (data, event) => {
		if (data === 'GameStart') {
			//give 5 minutes for betting to open
			console.log('Game has started when champ selected ended successfully');
			sendGameStateNotification(data);
			announceBetStart();
      openBetting();
		} else if (data === 'InProgress') {
			//we are currently in a match
			console.log('We are currently in a match');
			//sendGameStateNotification(data);
		} else if (data === 'None') {
			console.log(
				'this is after they have exited either queue, post game, or whatever'
			);

		} else {
			//sendGameStateNotification(data);
			console.log(data);
		}
	});

	//when the game ends, we need to give the rewards to the winners
	ws.subscribe('/lol-end-of-game/v1/eog-stats-block', (data, event) => {
		console.log('/lol-end-of-game/v1/eog-stats-block:', data); //this is important if we reach to the end of game stats screen
		const blueTeam = data['localPlayer']['teamId'];
		const hasWon = data['localPlayer']['stats']['WIN'];

		if (blueTeam === 100 && hasWon === 1) {
			//give rewards to everyone who betted on blue team
			console.log('blue team won');
			announceMatchResult('Blue'); // Announce match result
			distributePoints(); // Distribute points based on the result
		} else {
			//give rewards to everyone who betted on red team
			console.log('red team won');
			announceMatchResult('Red'); // Announce match result
			distributePoints(); // Distribute points based on the result
		}
	});

	// 4. Handle LeagueClient states
	const client = new LeagueClient(credentials);

	client.on('connect', (newCredentials) => {
		console.log('League Client has started.');

	});

	client.on('disconnect', () => {
		console.log('League Client has stopped.');


	});

	client.start();

	// Optional: Handle graceful shutdowns (e.g., from SIGINT)
	process.on('SIGINT', () => {
		client.stop(); // Stop listening to client state changes
		ws.close(); // Close the WebSocket connection
		process.exit(); // Exit the process
	});
}


