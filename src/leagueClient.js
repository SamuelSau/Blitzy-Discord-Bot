import  {
	authenticate,
	createWebSocketConnection,
	LeagueClient,
}  from 'league-connect';

import { announceBetStart, betMatch, announceMatchResult, distributePoints } from './discordBot.js';


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
		if (data === "GameStart") {
			//give 5 minutes for betting to open
			console.log("game has started when champ selected ended successfully");
			announceBetStart();

		}
		else if (data === "InProgress") {
			//we are currently in a match
			console.log("we are currently in a match");
			betMatch();
		}
		else if (data === "None") {
			//or whatever is actualy the postscreen match
			//then we give the rewards to whoever betted on the winner
			console.log("this is after they have exited the post game stats screen");
		}
		else {
			console.log(data);
		}
	});

	//when the game ends, we need to give the rewards to the winners
	ws.subscribe('/lol-end-of-game/v1/eog-stats-block', (data, event) => {
		console.log('/lol-end-of-game/v1/eog-stats-block:', data); //this is important if we reach to the end of game stats screen
		const blueTeam = data['teams'][0][100];
		const redTeam = data['teams'][1][200];

		if (blueTeam['isWinningTeam'] === true) {
			//give rewards to everyone who betted on blue team
			console.log('blue team won');
			announceMatchResult("Blue"); // Announce match result
            distributePoints();   // Distribute points based on the result

		}
		else {
			//give rewards to everyone who betted on red team
			console.log("red team won");
			announceMatchResult("Red"); // Announce match result
            distributePoints();   // Distribute points based on the result

		}
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


/*
SummonerIDs:

OmegaCube: VFm-fmnbpEDMV5bcUtJoFHvs7GXIbsXUje1M2wIUm-GOtR8
Larvesta: NzA8Z4AJHmDiVjgmHvx_dABrrs1clOhkZtWdbJ5NPnr2x38
pho boi: iHYG4rkavwCHeHgAUTi-iTOhkAM1YxdTRFslOYvzurGk2KQ
Wild Inosuke: -aTPIgytYXVtik0_08jmNglnwrXUu6QKCtTe_4qU5wr7Mmc
Bush Can Talk: JJlZzMHHmBqhpSTn946VFhIdK7Z5KCbnybc3zAwHH6CLxyY

if /lol-gameflow/v1/gameflow-phase == "GameStart" (we are in champ select):
	give 5 minutes for betting to open

if /lol-gameflow/v1/gameflow-phase == "InProgress" (we are currently in a match):

if /lol-gameflow/v1/gameflow-phase === "None": //or whatever is actualy the postscreen match
	then we give the rewards to whoever betted on the winner

if /lol-gameflow/v1/session (can also give us the phase and all other info), but this triggers at every phase:
 {
  gameClient: {
    observerServerIp: 'spectator-consumer.na1.lol.pvp.net',
    observerServerPort: 80,
    running: true,
    serverIp: '192.64.168.225',
    serverPort: 5225,
    visible: false
  },
  gameData: {
    gameId: 4853671673,
    gameName: '',
    isCustomGame: true,
    password: '',
    playerChampionSelections: [ [Object] ],
    queue: {
      allowablePremadeSizes: [],
      areFreeChampionsAllowed: true,
      assetMutator: '',
      category: 'Custom',
      championsRequiredToPlay: 0,
      description: '',
      detailedDescription: '',
      gameMode: 'CLASSIC',
      gameTypeConfig: [Object],
      id: -1,
      isRanked: false,
      isTeamBuilderManaged: false,
      lastToggledOffTime: 0,
      lastToggledOnTime: 0,
      mapId: 11,
      maximumParticipantListSize: 5,
      minLevel: 0,
      minimumParticipantListSize: 0,
      name: '',
      numPlayersPerTeam: 5,
      queueAvailability: 'Available',
      queueRewards: [Object],
      removalFromGameAllowed: false,
      removalFromGameDelayMinutes: 0,
      shortName: '',
      showPositionSelector: false,
      spectatorEnabled: false,
      type: 'PRACTICE_GAME'
    },
    spectatorsAllowed: false,
    teamOne: [ [Object] ],
    teamTwo: []
  },
  gameDodge: { dodgeIds: [], phase: 'None', state: 'Invalid' },
  map: {
    assets: {
      'champ-select-background-sound': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Shared/sound/music-cs-blindpick-default.ogg',
      'champ-select-flyout-background': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/champ-select-flyout-background.jpg',
      'champ-select-planning-intro': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/champ-select-planning-intro.jpg',
      'game-select-icon-active': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/game-select-icon-active.png',
      'game-select-icon-active-video': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/video/game-select-icon-active.webm',
      'game-select-icon-default': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/game-select-icon-default.png',
      'game-select-icon-disabled': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/game-select-icon-disabled.png',
      'game-select-icon-hover': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/game-select-icon-hover.png',
      'game-select-icon-intro-video': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/video/game-select-icon-intro.webm',
      'gameflow-background': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/gameflow-background.jpg',
      'gameflow-background-dark': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/gameflow-background-dark.jpg',
      'gameselect-button-hover-sound': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Shared/sound/sfx-gameselect-button-hover.ogg',
      'icon-defeat': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/icon-defeat.png',  
      'icon-defeat-v2': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/icon-defeat-v2.png',
      'icon-defeat-video': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/video/icon-defeat.webm',
      'icon-empty': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/icon-empty.png',    
      'icon-hover': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/icon-hover.png',    
      'icon-leaver': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/icon-leaver.png',  
      'icon-leaver-v2': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/icon-leaver-v2.png',
      'icon-loss-forgiven-v2': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/icon-loss-forgiven-v2.png',
      'icon-v2': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/icon-v2.png',
      'icon-victory': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/icon-victory.png',      'icon-victory-video': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/video/icon-victory.webm',
      'map-north': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/map-north.png',      
      'map-south': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/map-south.png',      
      'music-inqueue-loop-sound': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/sound/music-inqueue-loop-summonersrift.ogg',
      'parties-background': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/parties-background.jpg',
      'postgame-ambience-loop-sound': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/sound/sfx-ambience-loop-summonersrift.ogg',
      'ready-check-background': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/ready-check-background.png',
      'ready-check-background-sound': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/sound/sfx-readycheck-sr-portal.ogg',
      'sfx-ambience-pregame-loop-sound': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/sound/sfx-ambience-loop-summonersrift.ogg',
      'social-icon-leaver': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/social-icon-leaver.png',
      'social-icon-victory': 'lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/social-icon-victory.png'
    },
    categorizedContentBundles: {},
    description: "The newest and most venerated battleground is known as Summoner's Rift. Traverse down one of three different paths in order to attack your enemy at their weakest point. Work with your allies to siege the enemy base and destroy their Nexus!",
    gameMode: 'CLASSIC',
    gameModeName: "Summoner's Rift",
    gameModeShortName: "Summoner's Rift",
    gameMutator: '',
    id: 11,
    isRGM: false,
    mapStringId: 'SR',
    name: "Summoner's Rift",
    perPositionDisallowedSummonerSpells: {},
    perPositionRequiredSummonerSpells: {},
    platformId: '',
    platformName: '',
    properties: { suppressRunesMasteriesPerks: false }
  },
  phase: 'InProgress'
}

*/



