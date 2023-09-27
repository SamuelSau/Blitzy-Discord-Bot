import { Client, GatewayIntentBits } from 'discord.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
import {} from 'dotenv/config'
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

export function startDiscordBot() {
	// ... rest of your Discord bot logic ...

	client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
      });

	client.login(DISCORD_BOT_TOKEN);
}
