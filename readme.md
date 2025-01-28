# GPT Conversation Bot with RAG Support

This Node.js project creates an interactive chatbot using OpenAI's GPT-4 model, enhanced by Retrieval-Augmented Generation (RAG) capabilities. It incorporates:

- **Chalk** for colorful console output.
- **MySQL** as the database for message storage and retrieval.
- **TensorFlow.js** with the Universal Sentence Encoder for embedding-based memory retrieval.
- **Cosine Similarity** to find relevant conversations in the database.

## 🚀 Features

- **Conversation Persistence:** Maintains context for ongoing conversations.
- **Memory Retrieval:** Finds relevant past messages using semantic similarity and date range filtering.
- **Dynamic System Messages:** Provides real-time enhancements, such as including the current EST time.
- **Customizable Tool Calls:** Supports memory retrieval and date-based memory filtering as tools.

## ⚙️ Installation

### Prerequisites

- Node.js (v16 or later)
- MySQL Server
- TensorFlow.js (via `@tensorflow/tfjs-node`)
- OpenAI API key

### Dependencies

Install the required dependencies:

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root directory with the following keys:

```env
OPENAI_API_KEY=your_openai_api_key
GPT_MODEL=gpt-4
DATABASE_HOSTNAME=localhost
DATABASE_USER=your_db_user
DATABASE_PASSWORD=your_db_password
DATABASE_NAME=your_db_name
```

## 📝 Usage

1. **Start the MySQL Database**
   Ensure the MySQL server is running and the database schema includes a `messages` table with the following structure:

   ```sql
   CREATE TABLE messages (
       id INT AUTO_INCREMENT PRIMARY KEY,
       userID VARCHAR(255),
       message TEXT,
       repliedToMessage TEXT,
       embedding JSON,
       timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Run the Application**
   Start the chatbot by running:

   ```bash
   node app.js
   ```

3. **Interact with the Bot**
   Use the `chat` function from `genAI.js` to send prompts and retrieve responses. The `chat` function relies on utility functions in `database.js` to handle memory retrieval.

## 📂 Code Overview

### Key Files

- `app.js`: Entry point for the application.
- `database.js`: Handles database interactions for logging events and retrieving messages.
- `genAI.js`: Core logic for interacting with OpenAI's GPT model and managing conversation threads using the `chat` function.

### chat Function

The `chat` function in `genAI.js` supports:

- **Memory Retrieval:** Uses embeddings and cosine similarity via utility functions in `database.js` to find relevant past messages.
- **Dynamic Prompts:** Generates system prompts with real-time context (e.g., EST time).
- **Conversation History:** Maintains a message history for each user.

### Tools

- `retrieveMemory`: Finds semantically relevant messages.
- `retrieveMemoryByDateRange`: Retrieves messages within a specified date range.

## 📦 Dependencies

```json
{
  "dependencies": {
    "@tensorflow-models/universal-sentence-encoder": "^1.3.3",
    "@tensorflow/tfjs-node": "^4.22.0",
    "chalk": "^5.4.1",
    "dotenv": "^16.4.7",
    "mysql2": "^3.12.0",
    "openai": "^4.80.1"
  }
}
```

## 🔍 How It Works

1. **Conversation Initialization:**
   - The chatbot tracks conversation threads by `senderID`.
   - New threads are initialized as needed.

2. **Memory Storage:**
   - User messages are stored in a MySQL database with embeddings generated by the Universal Sentence Encoder.

3. **Memory Retrieval:**
   - The `chat` function calls `retrieveMemory` and `retrieveMemoryByDateRange` from `database.js` to find relevant messages.
   - Cosine similarity is used to compare user queries with stored embeddings.

4. **GPT Integration:**
   - OpenAI's GPT-4 generates responses based on the conversation context and retrieved memories.

5. **Dynamic System Messages:**
   - Includes real-time context like current EST time.

## 🤝 Contributing

Feel free to open issues or submit pull requests to improve this project.

---

### 💡 Example Usage

```javascript
const { chat } = require('./genAI');

(async () => {
  const senderID = 'user123';
  const prompt = 'What can you remember about my favorite pet?';

  const response = await chat(senderID, prompt);
  console.log(response.body);
})();
```

## 🙏 Acknowledgments

- OpenAI for the GPT-4 API.
- TensorFlow.js for text embedding models.
- Chalk for making console output visually appealing.