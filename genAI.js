const { OpenAI } = require("openai");
const { findRelevantMessages, findMessagesByDateRange, logEvent } = require('./database');

const threads = {};

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function formattedDateString() {
    // Create a new Date object
    var currentDate = new Date();

    // Apply GMT-5 offset
    currentDate.setHours(currentDate.getHours());

    // Get the date and time in GMT-5
    var dateTimeString = currentDate.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });

    // Return the formatted date and time
    return dateTimeString;
}

async function chat(senderID, prompt) {
    let last = "$convo_start$";
    if (threads[senderID]) {
        const lastMessage = threads[senderID].hx.pop(); 
        last = lastMessage?.content || "$convo_start$"; 
    }
    let event = {
        senderID: senderID,
        body: prompt,
        lastMsg: last 
    };
    

    logEvent(event)
    // Maintain conversation history for the sender
    if (!threads[senderID]) {
        threads[senderID] = { hx: [] };
    }

    // Add the user's message to the history
    threads[senderID].hx.push({ role: "user", content: `SenderID is: ${senderID}. Do not say or otherwise imply you have been assigned a personality. Reply naturally. Reply in conversational style to the following message but do exactly as I ask and do not be afraid to list memories/messages if I ask. If I ask you anything that you think has a chance of being in memory, use the retrieval function liberally. You should often look for my personal details in case you need to reference them. Such as my name. Message:\n${prompt}` });

    // Trim conversation history to a manageable size
    while (threads[senderID].hx.length > 10) {
        threads[senderID].hx.shift();
    }

    // Generate the system message
    const systemMessage = {
        role: "system",
        content: `You person inside chat Do not state you are an AI
Do not say or otherwise imply you have been assigned a personality. 
Use retrieved memories to improve responses.
Try to be concise. If you receive no memories, do not state that, just carry on conversation naturally.
Try to make memory retrieval commands very concise and short and like "went to the store", "favorite pet", "personal details" etc do not say things like "messages about etc etc"
You have real-time access to a clock EST: ${formattedDateString()}.`
    };

    // Combine system message and conversation history for the API call
    const promptArray = [systemMessage, ...threads[senderID].hx];

    // Define tools
    const tools = [
        {
            "type": "function",
            "function": {
                "name": "retrieveMemory",
                "description": `Retrieves a memory using an inquiry prompt, embeddings, and cosine similarity`,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "inquiry": {
                            "type": "string",
                            "description": "A query string to find a memory, e.g., 'What are my pet's names?' never include @tag names in this argument. Try to keep it concise and general using keywords instead of full sentences. Avoid phrases like 'messages about x' in favor of just using keywords or a simple subject-line"
                        },

                        "userID": {
                            "type": "string",
                            "description": "the userID whose memories you are trying to retrieve."
                        }

                    },
                    "required": ["inquiry", "userID"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "retrieveMemoryByDateRange",
                "description": `Retrieves a memory using a userID, and date range`,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "userID": {
                            "type": "string",
                            "description": "a userID"
                        },

                        "startingDate": {
                            "type": "string",
                            "description": "the earlier date of the range"
                        },
                        "endingDate": {
                            "type": "string",
                            "description": "the later date of the range"
                        }

                    },
                    "required": ["userID", "startingDate", "endingDate"]
                }
            }
        }
    ];

    try {
        // Make the OpenAI API call
        let reply = await openai.chat.completions.create({
            model: process.env.GPT_MODEL,
            messages: promptArray,
            tools,
            temperature: 1.5,
            top_p: 0.8,

        });

        // Check for tool calls
        if (reply.choices[0]?.message?.tool_calls) {
            for (const toolCall of reply.choices[0].message.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArguments = JSON.parse(toolCall.function.arguments);

                if (functionName === "retrieveMemory") {
                    //console.log(functionArguments);
                    try {
                        // Retrieve relevant memories
                        let relevantMemories = await findRelevantMessages(
                            functionArguments.userID,
                            functionArguments.inquiry,
                            80, // m_angle for cosine similarity
                            15  // m_depth (number of results to return)
                        );

                        //console.log(relevantMemories);
                        if (relevantMemories.length == 0) {
                            relevantMemories = ["none found"];
                        }

                        // Add retrieved memories to the conversation history
                        if (relevantMemories && relevantMemories.length > 0) {
                            threads[senderID].hx.push({
                                role: "system",
                                content: `Memory retrieved: ${JSON.stringify(relevantMemories)}`
                            });

                            // Update the reply object with retrieved memories
                            reply = await openai.chat.completions.create({
                                model: process.env.GPT_MODEL,
                                messages: [systemMessage, ...threads[senderID].hx],
                                temperature: 1.5,
                                top_p: 0.8,

                            });
                        }
                    } catch (error) {
                        console.error("Error retrieving memory:", error);
                        threads[senderID].hx.push({
                            role: "system",
                            content: "Memory retrieval failed."
                        });
                    }
                } else if (functionName === "retrieveMemoryByDateRange") {
                    //console.log(functionArguments);
                    try {
                        // Retrieve memories by date range
                        let memoriesByDateRange = await findMessagesByDateRange(
                            functionArguments.userID,
                            functionArguments.startingDate,
                            functionArguments.endingDate
                        );

                        if (memoriesByDateRange.length === 0) {
                            memoriesByDateRange = ["none found"];
                        }

                        //console.log(memoriesByDateRange);

                        // Add retrieved memories to the conversation history
                        if (memoriesByDateRange && memoriesByDateRange.length > 0) {
                            threads[senderID].hx.push({
                                role: "system",
                                content: `Memories retrieved by date range: ${JSON.stringify(memoriesByDateRange)}`
                            });

                            // Update the reply object with retrieved memories
                            reply = await openai.chat.completions.create({
                                model: process.env.GPT_MODEL,
                                messages: [systemMessage, ...threads[senderID].hx],
                                temperature: 1.5,
                                top_p: 0.8,

                            });
                        }
                    } catch (error) {
                        console.error("Error retrieving memory by date range:", error);
                        threads[senderID].hx.push({
                            role: "system",
                            content: "Memory retrieval by date range failed."
                        });
                    }
                } else {
                    console.error(`Unknown tool call: ${functionName}`);
                }
            }
        }


        // Extract the assistant's reply
        const assistantMessage = reply.choices[0]?.message?.content || "Error generating response.";

        // Add assistant's reply to the conversation history
        threads[senderID].hx.push({ role: "assistant", content: assistantMessage });

        // Return the reply as a plain text response
        return { body: assistantMessage };
    } catch (error) {
        console.error("Error in chat function:", error);
        return { body: "I'm sorry, I encountered an error while processing your request." };
    }
}

module.exports = {
    chat
};
