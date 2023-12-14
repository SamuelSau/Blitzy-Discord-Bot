import axios from 'axios';
import {} from 'dotenv/config';
// Assuming you have functions from your Discord bot logic
import { announceBetStart } from './discordBot.js';

const myFriendsWithSummonerIds = new Map();
const RIOT_API_KEY = process.env.RIOT_API_KEY;

// populate the map with the summoner ids values and keys as the summoners name based on the friends list (hardcoded for now lol, could do dynamically if wanted)
myFriendsWithSummonerIds.set(
	'OmegaCube',
	'VFm-fmnbpEDMV5bcUtJoFHvs7GXIbsXUje1M2wIUm-GOtR8'
);
myFriendsWithSummonerIds.set(
	'Larvesta',
	'NzA8Z4AJHmDiVjgmHvx_dABrrs1clOhkZtWdbJ5NPnr2x38'
);
myFriendsWithSummonerIds.set(
	'pho boi',
	'iHYG4rkavwCHeHgAUTi-iTOhkAM1YxdTRFslOYvzurGk2KQ'
);
myFriendsWithSummonerIds.set(
	'Wild Inosuke',
	'-aTPIgytYXVtik0_08jmNglnwrXUu6QKCtTe_4qU5wr7Mmc'
);

myFriendsWithSummonerIds.set(
	'l1mhady',
	'jQYRWJILlaBW5TytRqznmGd1cumCvoCZY-bvx_RbV7Bb_gY'
)


/*
SummonerIDs:

OmegaCube: VFm-fmnbpEDMV5bcUtJoFHvs7GXIbsXUje1M2wIUm-GOtR8
Larvesta: NzA8Z4AJHmDiVjgmHvx_dABrrs1clOhkZtWdbJ5NPnr2x38
pho boi: iHYG4rkavwCHeHgAUTi-iTOhkAM1YxdTRFslOYvzurGk2KQ
Wild Inosuke: -aTPIgytYXVtik0_08jmNglnwrXUu6QKCtTe_4qU5wr7Mmc
Bush Can Talk: JJlZzMHHmBqhpSTn946VFhIdK7Z5KCbnybc3zAwHH6CLxyY
*/

const checkInterval = 30000; // Check every 30 seconds

export async function startFriendTracking() {
	setInterval(async () => {
		for (const [friend, summmonerId] of myFriendsWithSummonerIds) {
			try {
				const response = await axios.get(//i think this endpoint isnt work for now :(
					`https://na1.api.riotgames.com/lol/spectator/v4/active-games/by-summoner/${summmonerId}?api_key=${RIOT_API_KEY}`
				);
				const data = response.data;

				// Logic to check if the friend is in a game
				if (data) { //200 response that friend is in a game
					//print the summoner name associated with the summonerId
					console.log(`${friend} is in a game!`);
					announceBetStart();
				} else {
					console.log('Data is NULL\n');
					console.log(`${friend} is not in a game!`);
				}
			} catch (error) {

                if (error.response) {
					console.log(error.response)
                    console.log(`${friend} is not in a game!`);
                }
				else if (error.request){
					console.log(error.request);
				}					
				
                else{
                    console.error(`Error checking status for ${friend}:`, error.message);

                }
			}
		}
	}, checkInterval);
}
