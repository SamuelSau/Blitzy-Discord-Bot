import { EmbedBuilder} from 'discord.js';


const winDescriptions = [
    'A magnificent victory!',
    'You dominated the battlefield!',
    'Victory is yours!',
    "HE'S HIM",
    "GG EZ",
    "TOO GOOD",
    "DUY GOT FIRED",
    "HIEU CANNOT COOK",
    "PHILLIP IS UNEMPLOYED",
    "ALEX BECAME HOMELESS",
    "KEVIN BLINDED MY EYES",
    "I'M FAKER'S SON"
];

const loseDescriptions = [
    'Tough luck this time!',
    'A valiant effort, despite the loss.',
    'The defeat is only a stepping stone to success.',
    'GG TEAM SUCKS',
    "SHOULD'VE DODGED",
    "UNLUCKY TEAM",
    "ALWAYS BLAME JG",
    "WHY THEY HAVE SO MANY SMURFS",
    "I'M NOT ON COPIUM, I SWEAR",
    "IT'S BECAUSE DUY IS ON MY TEAM",
    "HIEU PLAYS LIKE LEE SIN AKA BLIND",
    "ALEX DRANK A LITTLE TOO MUCH BEFORE THIS GAME"
];

export async function createGifEmbeddings(result, channel){

    if (!channel) {
        console.error(`Channel not found`);
        return;
    }

    const settings = {
        won: {
            color: 0x00FF00,
            gifUrl: 'https://media.giphy.com/media/lb53j9OkavEfxojVdL/giphy.gif',
            url: 'https://giphy.com/gifs/leagueoflegends-tft-pengu-teamfight-tactics-lb53j9OkavEfxojVdL',
            footerText: 'Champion!',
        },
        lost: {
            color: 0xFF0000,
            gifUrl: 'https://media.giphy.com/media/KznLOEq0pjNfXkZHaN/giphy.gif',
            url: 'https://giphy.com/gifs/leagueoflegends-tft-pengu-teamfight-tactics-KznLOEq0pjNfXkZHaN',
            footerText: 'Keep fighting!',
        }
    };

    const embedSettings = result === 'won' ? settings.won : settings.lost;
    const description = getRandomDescription(result);

	const matchEmbed = new EmbedBuilder()
    .setColor(embedSettings.color)
    .setTitle(result.charAt(0).toUpperCase() + result.slice(1))
    .setURL(embedSettings.url)
	.setAuthor({ name: 'League Of Legends', iconURL: 'https://media.giphy.com/avatars/leagueoflegends/RPBOVet8mekW/200h.jpeg', url: 'https://giphy.com/leagueoflegends' })
	.setDescription(description)
	.setThumbnail('https://i.imgur.com/AfFherep7pu.png')
	.addFields({ name: '******', value: '------', inline: true })
	.setImage(embedSettings.gifUrl)
	.setTimestamp()
    .setFooter({ text: embedSettings.footerText, iconURL: 'https://i.imgur.com/AfFp7pu.png' });

	channel.send({ embeds: [matchEmbed] });

    //client.login(DISCORD_BOT_TOKEN);

}

// Function to randomly select a description based on the match result
function getRandomDescription(result) {
    if (result === 'won') {
        return winDescriptions[Math.floor(Math.random() * winDescriptions.length)];
    } else {
        return loseDescriptions[Math.floor(Math.random() * loseDescriptions.length)];
    }
}
