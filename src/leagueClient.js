import  {
	authenticate,
	createWebSocketConnection,
	LeagueClient,
}  from 'league-connect';

export async function startLeagueClient() {
    // ... all the logic for starting, handling, and monitoring the League client ...
    // 1. Authenticate to get credentials
	const credentials = await authenticate({
		awaitConnection: true,
		pollInterval: 5000,
	});

	// 2. Establish a WebSocket connection
	const ws = await createWebSocketConnection({
		authenticationOptions: {
			awaitConnection: true,
		},
	});

	// 3. Subscribe to the endpoint
	ws.subscribe('/lol-login/v1/account-state', (data, event) => {
		// This is where you handle the data from the WebSocket.
		// For instance, you can send a Discord message based on the event data.
		console.log('Received data from WebSocket:', data);

		// ... Discord bot logic to broadcast or reply to a message ...
	});

	// 4. Handle LeagueClient states
	const client = new LeagueClient(credentials);

	client.on('connect', (newCredentials) => {
		console.log('League Client has started.');
		// Maybe send a message to a specific Discord channel notifying that the League Client has connected.
		// ... Discord bot logic to send a message ...
	});

	client.on('disconnect', () => {
		console.log('League Client has stopped.');

		// Maybe send a message to a specific Discord channel notifying that the League Client has disconnected.
		// ... Discord bot logic to send a message ...
	});

	client.start();

	// Optional: Handle graceful shutdowns (e.g., from SIGINT)
	process.on('SIGINT', () => {
		client.stop(); // Stop listening to client state changes
		ws.close(); // Close the WebSocket connection
		process.exit(); // Exit the process
	});
}



