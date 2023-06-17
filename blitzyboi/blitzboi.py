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

tasks = {}

# Define the Queue with deque from collections.
class Queue:
    def __init__(self):
        self.games = collections.deque()
    
    def __len__(self):
        return len(self.games)
        
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
    points INTEGER
    );
''')
cursor.execute('''
    CREATE TABLE IF NOT EXISTS match (
    match_id TEXT PRIMARY KEY,
    game_start_time INTEGER,
    game_end_time INTEGER,
    game_result TEXT
    );
''')
cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_bets (
    bet_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    match_id TEXT,
    points_bet INTEGER,
    prediction TEXT,
    FOREIGN KEY(user_id) REFERENCES user_points(user_id),
    FOREIGN KEY(match_id) REFERENCES match(match_id)
    );
''')

'''
############
SQL QUERIES
############
'''

def get_user_points(user_id):
    cursor.execute(f'SELECT points FROM user_points WHERE user_id = {user_id}')
    result = cursor.fetchone()
    if result is None:
        cursor.execute(f'INSERT INTO user_points VALUES ({user_id}, 500)')
        conn.commit()
        return 500
    else:
        return result[0]

def update_user_points(user_id, points):
    cursor.execute(f'UPDATE user_points SET points = {points} WHERE user_id = {user_id}')
    conn.commit()

def update_user_points(user_id, points):
    cursor.execute(f'UPDATE user_points SET points = {points} WHERE user_id = {user_id}')
    conn.commit()

def update_user_bets(user_id, points_bet, match_id, prediction):
    cursor.execute(f'INSERT INTO user_bets(user_id, match_id, points_bet, prediction) VALUES ({user_id}, "{match_id}", {points_bet}, "{prediction}")')
    conn.commit()

def get_user_bets(user_id, match_id):
    cursor.execute(f'SELECT points_bet, prediction FROM user_bets WHERE user_id = {user_id} AND match_id = "{match_id}"')
    result = cursor.fetchone()
    if result is None:
        return None, None
    else:
        return result[0], result[1]  # points_bet, prediction

def get_game_times(match_id):
    cursor.execute(f'SELECT game_start_time, game_end_time FROM match WHERE match_id = "{match_id}"')
    result = cursor.fetchone()

    if result is None:
        return None, None
    else:
        return result[0], result[1]

'''
############
DISCORD COMMANDS/RELATED STUFF
############
'''

@bot.event
async def on_ready():
    print(f'We have logged in as {bot.user}')

'''
Usage !track <summonerName> that calls the track_summoner function, checks if user in-game, otherwise retry another 20 minutes
'''
@bot.command()
async def track(ctx, summoner_name: str):

    summoner_id, puuid = get_summoner_info(summoner_name)
    tasks[summoner_name] = asyncio.create_task(track_summoner(ctx, summoner_id, summoner_name, puuid))

'''
Finds if the summoner is currently playing and stops tracking them
'''
@bot.command()
async def stoptrack(ctx, summoner_name):
    task = tasks.get(summoner_name)
    if task:
        task.cancel()
        await ctx.send(f'Stopping tracking for {summoner_name}.')
    else:
        await ctx.send(f'Not currently tracking {summoner_name}.')

'''
Usage: !bet <amount> <status>
Only bet valid amount of points and can only within 5 minutes when game started
'''
@bot.command()
async def bet(ctx, points: int, prediction: str):
    user_id = ctx.author.id
    user_name = ctx.author.name
    user_points = get_user_points(user_id)

    # Fetch summoner details from game_queue
    if len(game_queue) > 0:
        current_game = game_queue[0]
        summoner_id = current_game["summoner_id"]
        summoner_name = current_game["summoner_name"]
        match_id = current_game["matchId"]
    else:
        # Handle the case when there's no game in the queue
        await ctx.send("No game to bet on.")
        return

    summoner_in_game = await check_if_summoner_in_game(ctx, summoner_id, summoner_name)

    time_passed_game_length = summoner_in_game['gameLength'] #in seconds 

    if user_points <= 0:
        await ctx.send(f"{user_name} cannot bet with {user_points} points")
        
    if points <= 0:
        await ctx.send(f"{user_name} cannot bet {points} points")
        
    if points > user_points:
        difference = points - user_points
        await ctx.send(f'{user_name}, you cannot bet more points than you have')
        await ctx.send(f'{user_name} is short of {difference} points')
        
    else:
        
        if not game_queue: #empty queue
            await ctx.send('No game to bet on')

        else:
            seconds = 60
            minutes = 5
            closing_period = time_passed_game_length * minutes > (seconds * minutes) #more than 5 minutes from start time
            
            if closing_period:
                await ctx.send(f'{user_name}, betting for the current game is closed. You had {seconds * minutes} minutes nub')
                
            user_points -= points
            await ctx.send(f"{user_name} has bet {points} points")
            await ctx.send(f"{user_name} currently now has {user_points} points left")
            
            update_user_points(user_id, user_points)

            if len(game_queue.games) > 0: #at least 1 game
                match_id = game_queue.games[0]
            
            if len(game_queue.games) == 0: #no games
                match_id = None

            if match_id: #maybe have a while loop that keeps checking if game is done
                game_result = check_game_result(match_id, summoner_name)
                if game_result == 'victory' and prediction == 'victory':
                    user_points = user_points + (points * 2)
                    update_user_points(user_id, user_points)
                    await ctx.send(f'You predicted {prediction} and won the bet! You now have {user_points} points.')
                elif game_result == 'defeat' and prediction == 'defeat':
                    user_points = user_points - (points * 2)
                    update_user_points(user_id, user_points)
                    await ctx.send(f'You predicted {prediction} and lost the bet. You now have {user_points} points.')
                else: #not valid game result
                    ctx.send(f"Sorry, {user_name}. Error retrieving game result")
            else:
                await ctx.send('No game to bet on.')

'''
############
TRACKING SUMMONERS
############
'''

async def track_summoner(ctx, summoner_id, summoner_name, puuid):
    global last_added_game_id
    
    while True:
        is_in_game = await check_if_summoner_in_game(ctx, summoner_id, summoner_name)

        if is_in_game:
            
            most_current_match_id = requests.get(f"https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=1&api_key={RIOT_API_KEY}")
            
            if most_current_match_id.status_code == 200:

                if most_current_match_id != last_added_current_id: #user is in-game for another match
                    new_game = {
                        "matchId": most_current_match_id,
                        "summoner_id": summoner_id,
                        "summoner_name": summoner_name,
                        "start_time": time.time()
                    }
                    game_queue.append(new_game)
                    last_added_current_id = most_current_match_id
                    await ctx.send(f'Found {summoner_name} in-game!')
    
                if len(game_queue.games) > 0: 
                    finished_game = check_first_game(game_queue, puuid)
                    if finished_game:
                        result = handle_finished_game(finished_game, summoner_name)
                        await ctx.send(result)
            else:
                print(f"Failed to get match id and got status code of {most_current_match_id.status_code}")
                await ctx.send(f"Failed to get current match and got status code of {most_current_match_id.status_code}")
                await asyncio.sleep(1200)
        else:
            await asyncio.sleep(1200)


'''
############
FUNCTIONS FOR MATCH DETAILS, SUMMONERS, FINISHED GAME, ETC
############
'''

#Returns the summonerId and puuid from a summonerName    
def get_summoner_info(summoner_name: str):
    response = requests.get(f"https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/{summoner_name}?api_key={RIOT_API_KEY}")
    if response.status_code == 200:
        data = response.json()
        return (data['id'], data['puuid'])
    return None, None


#Returns the entire JSON response or False if summoner in-game
async def check_if_summoner_in_game(ctx, summoner_id:str, summoner_name:str):
    response = requests.get(f"https://na1.api.riotgames.com/lol/spectator/v4/active-games/by-summoner/{summoner_id}?api_key={RIOT_API_KEY}")
    if response.status_code == 200:
        return response.json()
    else:
        print(f'{summoner_name} not in-game and status code is {response.status_code}. Rechecking in 20 minutes')
        await ctx.send(f"{summoner_name} not in-game. Rechecking in 20 minutes")
        return False


#Checks if 1st match in list, and if the game has started, then remove from queue
def check_first_game(game_queue, puuid:str):
    response = requests.get(f"https://na1.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=1&api_key={RIOT_API_KEY}")
    if response.status_code == 200:
        first_game = response.json()[0]
        if first_game == game_queue['matchId']:
            return game_queue.popleft()
    else:
        print(f"Error for check_first_game() with status code: {response.status_code}")
        return None

#Returns the game result if it has been done
def check_game_result(match_id:str, summoner_name: str):
    match_detail = get_match_details(match_id)
    for i in range(10):
        summonerName =  match_detail['info']['participants'][i]
        if summonerName == summoner_name:
            has_won = match_detail['info']['participants']['win']

            if has_won:
                return 'victory'
            else:
                return 'defeat'

#Returns to discord bot the results
def handle_finished_game(match_id:str, summoner_name:str):
    game_result = check_game_result(match_id)
    return f"Game with {match_id} from {summoner_name} has finished. The result is: {game_result}."

#Returns all the detailed information for a specific match
def get_match_details(match_id: str):
    response = requests.get(f"https://americas.api.riotgames.com/lol/match/v5/matches/{match_id}?api_key={RIOT_API_KEY}")
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Cannot return match details with status code: {response.status_code}")

bot.run(DISCORD_TOKEN)