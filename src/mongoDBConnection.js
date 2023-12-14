import { MongoClient } from 'mongodb';
import {} from 'dotenv/config';

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);

export async function connectMongoDB() {
    try {
        
        await client.connect();
        console.log("Connected successfully to MongoDB");
        return client.db(process.env.MONGODB_DB_NAME);
    } catch (e) {
        console.error("Failed to connect to MongoDB", e);
    }
}
