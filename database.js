require('dotenv').config();
const mysql = require('mysql2');
const { getModel } = require('./modelManager');

// Create the database connection
const db = mysql.createConnection({
    host: process.env.DATABASE_HOSTNAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        process.exit(1); // Exit the application if connection fails
    }
    //console.log('Connected to the database');
});

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (normA * normB);
}

const findRelevantMessages = async (userID, query, m_angle, m_depth) => {
    if (m_angle < 0 || m_angle > 180) {
        throw new Error("m_angle must be between 0 and 180");
    }

    const similarityThreshold = 1 - (m_angle / 90); // Convert angle to cosine similarity threshold
    const queryWords = query.toLowerCase().split(/\s+/); // Split query into words

    try {
        const model = await getModel(); // Load the model
        const queryEmbeddingTensor = await model.embed([query]); // Generate the query embedding
        const queryEmbedding = queryEmbeddingTensor.arraySync()[0]; // Convert tensor to array

        const sql = 'SELECT message, embedding, timestamp FROM messages WHERE userID = ? AND embedding IS NOT NULL';
        const [rows] = await db.promise().query(sql, [userID]); // Fetch data from the database

        const relevantMessages = rows
            .map(row => {
                let embedding;
                try {
                    if (Array.isArray(row.embedding)) {
                        embedding = row.embedding; // Already parsed as array
                    } else if (typeof row.embedding === 'string') {
                        embedding = row.embedding.startsWith('[')
                            ? JSON.parse(row.embedding) // Parse JSON
                            : row.embedding.split(',').map(Number); // Split string
                    } else if (Buffer.isBuffer(row.embedding)) {
                        const embeddingString = row.embedding.toString();
                        embedding = embeddingString.startsWith('[')
                            ? JSON.parse(embeddingString)
                            : embeddingString.split(',').map(Number);
                    } else {
                        throw new Error('Unsupported embedding type');
                    }
                } catch (error) {
                    console.error(`Error parsing embedding for message with timestamp: ${row.timestamp}`, error);
                    return null; // Skip invalid embeddings
                }

                const similarity = cosineSimilarity(queryEmbedding, embedding);
                const messageWords = row.message.toLowerCase().split(/\s+/);
                const wordMatches = queryWords.filter(word => messageWords.includes(word)).length;

                return {
                    message: row.message,
                    timestamp: row.timestamp,
                    similarity: similarity,
                    wordMatches: wordMatches,
                };
            })
            .filter(item => item && item.similarity >= similarityThreshold) // Filter by similarity threshold
            .sort((a, b) => {
                if (b.wordMatches !== a.wordMatches) {
                    return b.wordMatches - a.wordMatches; // Prioritize more word matches
                }
                return b.similarity - a.similarity; // Fallback to similarity
            })
            .slice(0, m_depth); // Limit to m_depth results

        // Return the most relevant messages with timestamps only
        return relevantMessages.map(item => ({
            message: item.message,
            timestamp: item.timestamp,
        }));
    } catch (error) {
        console.error('Error finding relevant messages:', error);
        throw error;
    }
};


const findMessagesByDateRange = async (userID, startingDate, endingDate) => {
    const timingData = { userID, startingDate, endingDate, steps: {} }; // Object to store timing data
    const startTotal = Date.now(); // Start total timer

    try {
        // Start timing for database query
        const startDB = Date.now();
        const sql = `
            SELECT message, timestamp 
            FROM messages 
            WHERE userID = ?
        `;
        const [rows] = await db.promise().query(sql, [userID]);
        timingData.steps.databaseFetch = Date.now() - startDB;

        // Convert date strings to Date objects
        const startDate = new Date(startingDate);
        const endDate = new Date(endingDate);

        // Start timing for processing results
        const startProcessing = Date.now();
        const filteredMessages = rows.filter(row => {
            const rowDate = new Date(row.timestamp); // Convert timestamp to Date object
            return rowDate >= startDate && rowDate <= endDate; // Check if within range
        }).map(row => ({
            message: row.message,
            timestamp: row.timestamp,
        }));
        timingData.steps.processing = Date.now() - startProcessing;

        // Total time
        timingData.totalTime = Date.now() - startTotal;

        // Write timing data to JSON file
        await logTimingData(timingData);

        // Return the filtered messages
        return filteredMessages;
    } catch (error) {
        console.error('Error retrieving messages by date range:', error);
        throw error;
    }
};

// Subroutine to insert a message
const insertMessage = async (senderID, message, repliedToMessage, embedding = null) => {
    const sql = `
      INSERT INTO messages (userID, message, repliedToMessage, embedding) 
      VALUES (?, ?, ?, ?)
    `;

    // Convert embedding to JSON if provided
    const embeddingJSON = embedding ? JSON.stringify(embedding) : null;

    await db.promise().query(sql, [senderID, message, repliedToMessage, embeddingJSON]);
    //console.log(`Message logged for senderID: ${senderID}`);
};

// Main function to log an event
const logEvent = async (event) => {
    if (!event.senderID || !event.body) {
      throw new Error('Invalid event object. senderID and body are required.');
    }
  
    const senderID = event.senderID;
    const message = event.body;
    let repliedToMessage = event.lastMsg;
  
    // Get the one-and-only loaded model, instead of loading it again
    const model = await getModel();
    const embeddingTensor = await model.embed([message]);
    const embeddingArray = embeddingTensor.arraySync()[0];
  
    // Log the message with the embedding
    await insertMessage(senderID, message, repliedToMessage, embeddingArray);
};

// Export the main function and fine-tuning export
module.exports = {
    logEvent,
    findRelevantMessages, 
    findMessagesByDateRange,

};
