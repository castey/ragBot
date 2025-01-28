(async () => {
    const chalk = (await import('chalk')).default;
    const { chat } = require('./genAI.js'); // Adjust the path as necessary

    // Function to simulate a conversation
    async function runChat() {
        console.log(chalk.yellow('Welcome to the chatbot! Type "exit" to end the conversation.\n'));

        const senderID = 1; // Static senderID for the session
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        function askQuestion(prompt) {
            return new Promise((resolve) => readline.question(prompt, resolve));
        }

        while (true) {
            const userInput = await askQuestion(chalk.blue('You: '));

            // Exit the conversation loop
            if (userInput.toLowerCase() === 'exit') {
                console.log(chalk.yellow('Goodbye!'));
                break;
            }

            // Get the chatbot response
            const response = await chat(senderID, userInput);

            // Display the bot's response in red
            console.log(chalk.red(`Bot: ${response.body}`));
        }

        readline.close();
    }

    // Start the chat application
    runChat();
})();
