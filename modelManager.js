// modelManager.js
const tf = require('@tensorflow/tfjs-node'); // this is required to register the backend it looks useless but it's not, just like you
const use = require('@tensorflow-models/universal-sentence-encoder');

let modelPromise = null;

// Function to load and reuse the Universal Sentence Encoder model
const getModel = async () => {
    if (!modelPromise) {
        
        modelPromise = use.load();
        await modelPromise; // Ensure the model is fully loaded
        
    }
    return modelPromise;
};

module.exports = { getModel };
