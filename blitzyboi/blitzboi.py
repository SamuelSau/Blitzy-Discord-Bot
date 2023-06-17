import requests
import collections
import discord
from discord.ext import commands
import asyncio 
import sqlite3
import time
from dotenv import load_dotenv
import os

load_dotenv()

RIOT_API_KEY = os.getenv("RIOT_API_KEY")
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")

# Define the Queue with deque from collections.
class Queue:
    def __init__(self):
        self.games = collections.deque()
        self.current_game_start_time = None

# Create an instance of Queue
game_queue = Queue()
last_added_game_id = None

intents = discord.Intents.default()
intents.messages = True
intents.guilds = True
intents.message_content = True 

bot = commands.Bot(command_prefix='!', intents=intents)

conn = sqlite3.connect('user_points.db')
cursor = conn.cursor()
cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_points (
    user_id INTEGER PRIMARY KEY,
    points INTEGER,
    match_id TEXT
    );
''')

def get_user_points(user_id):
    cursor.execute(f'SELECT points FROM user_points WHERE user_id = {user_id}')
    result = cursor.fetchone()

    if result is None:
        cursor.execute(f'INSERT INTO user_points VALUES ({user_id}, 500)')
        conn.commit()
        return 500
    else:
        return result[0]

def update_user_points(user_id, points, match_id=None):
    if match_id:
        cursor.execute(f'UPDATE user_points SET points = {points}, match_id = "{match_id}" WHERE user_id = {user_id}')
    else:
        cursor.execute(f'UPDATE user_points SET points = {points} WHERE user_id = {user_id}')
    conn.commit()

def get_user_match_id(user_id):
    cursor.execute(f'SELECT match_id FROM user_points WHERE user_id = {user_id}')
    result = cursor.fetchone()
    if result is None:
        return None
    else:
        return result[0]

def update_user_match_id(user_id, match_id):
    cursor.execute(f'UPDATE user_points SET match_id = "{match_id}" WHERE user_id = {user_id}')
    conn.commit()
    
@bot.event
async def on_ready():
    print(f'We have logged in as {bot.user}')

'''
Usage: !bet <amount> <status>
Only bet valid amount of points and can only within 5 minutes when game started
'''
@bot.command()
async def bet(ctx, points: int, prediction: str):
    user_id = ctx.author.id
    user_name = ctx.author.name
    user_points = get_user_points(user_id)

    if user_points <= 0:
        await ctx.send(f"{user_name} cannot bet with {user_points} points")
        
    if points <= 0:
        await ctx.send(f"{user_name} cannot bet {points} points")
        
    if points > user_points:
        difference = points - user_points
        await ctx.send(f'{user_name}, you cannot bet more points than you have')
        await ctx.send(f'{user_name} is short of {difference} points')
        
    else:
        seconds = 60
        minutes = 5
        current_time = time.time()
        closing_period = (current_time - game_queue.current_game_start_time) > (seconds * minutes) #5 minutes from start time
        if game_queue.current_game_start_time and closing_period:
            await ctx.send(f'{user_name}, betting for the current game is closed.')
            return

        user_points -= points
        await ctx.send(f"{user_name} has bet {points} points")
        await ctx.send(f"{user_name} currently now has {user_points} points left")
        
        update_user_points(user_id, user_points)

        if len(game_queue.games) > 0: #at least 1 game
            match_id = game_queue.games[0]
        
        if len(game_queue.games) == 0: #no games
            match_id = None

        if match_id:
            game_result = check_game_result(match_id)
            if game_result == 'win' and prediction == 'win':
                user_points = user_points + (points * 2)
                update_user_points(user_id, user_points)
                await ctx.send(f'You predicted {prediction} and won the bet! You now have {user_points} points.')
            elif game_result == 'loss' and prediction == 'loss':
                await ctx.send(f'You predicted {prediction} and lost the bet. You now have {user_points} points.')
                user_points = user_points - (points * 2)
                update_user_points(user_id, user_points)
            else: #not valid game result
                ctx.send(f"Sorry, {user_name}. Error retrieving game result")
        else:
            await ctx.send('No game to bet on.')

'''
Usage !track <summonerName>, checks if user in-game, otherwise retry another 20 minutes
'''
@bot.command()
async def track(ctx, summoner_name):

    global last_added_game_id
    summoner_id, puuid = get_summoner_info(summoner_name)

    while True:

        is_in_game = await check_if_summoner_in_game(ctx, summoner_id, summoner_name)

        if is_in_game:
            list_of_match_ids = requests.get(f"https://na1.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?api_key={RIOT_API_KEY}")
            
            most_current_match_id = list_of_match_ids[0]

            update_user_match_id(ctx.author.id, most_current_match_id)

            if most_current_match_id != last_added_current_id: #user is in-game for another match
                game_queue.games.append(most_current_match_id)
                last_added_current_id = most_current_match_id
                await ctx.send(f'Found {summoner_name} in-game!')
                game_queue.current_game_start_time = time.time()

            if len(game_queue.games) > 0: 
                finished_game = check_first_game(game_queue, puuid)
                if finished_game:
                    result = handle_finished_game(finished_game, summoner_name)
                    await ctx.send(result)
        
        else:
            await asyncio.sleep(1200)

'''
Returns the summonerId and puuid from a summonerName
'''     
def get_summoner_info(summoner_name):
    response = requests.get(f"https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/{summoner_name}?api_key={RIOT_API_KEY}")
    if response.status_code == 200:
        data = response.json()
        return (data['id'], data['puuid'])
    return None, None

'''
Returns True or False if summoner in-game
'''
async def check_if_summoner_in_game(ctx, summoner_id, summoner_name):
    response = requests.get(f"https://na1.api.riotgames.com/lol/spectator/v4/active-games/by-summoner/{summoner_id}?api_key={RIOT_API_KEY}")
    if response.status_code == 200:
        return True
    else:
        print(f'{summoner_name} not in-game and status code is {response.status_code}. Rechecking in 20 minutes')
        await ctx.send(f"{summoner_name} not in-game. Rechecking in 20 minutes")
        return False

'''
Checks if 1st match in list, and if the game has started, then remove from queue
'''
def check_first_game(game_queue, puuid):
    response = requests.get(f"https://na1.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=1&api_key={RIOT_API_KEY}")
    if response.status_code == 200:
        match_detail = response.json()
        if match_detail['info']['gameDuration'] > 0:
            return game_queue.popleft()
    return None

def check_game_result(match_id):
    response = requests.get(f"https://na1.api.riotgames.com/lol/match/v5/matches/{match_id}?api_key={RIOT_API_KEY}")
    if response.status_code == 200:
        match_detail = response.json()
        print(match_detail['info']['participants']['summonerName']) #find the summonerName with the right team
        if match_detail['teams'][0]['win'] == 'win':
            return 'win'
        else:
            return 'loss'
    else:
        print(f"Received a status code of {response.status_code}")
        return None

def handle_finished_game(match_id, summoner_name):
    game_result = check_game_result(match_id)
    game_queue.current_game_start_time = None #restart game time
    return f"Game with {match_id} from {summoner_name} has finished. The result is: {game_result}."

bot.run(DISCORD_TOKEN)