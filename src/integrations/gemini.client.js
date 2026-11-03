const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GEMINI } = require('../config/env');

const genAI = new GoogleGenerativeAI(GEMINI.API_KEY);

const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        isValid: { type: "boolean" },
        errorReason: { type: "string", nullable: true },
        songs: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    artist: { type: "string" },
                    track: { type: "string" }
                },
                required: ["artist", "track"]
            }
        }
    },
    required: ["isValid"]
};

function buildPrompt({ mood, genre, artist, startYear, endYear, songCount }) {
    return `
        You are a music expert. Validate the following user inputs for a playlist:
        - Mood/Activity: "${mood}"
        - Genre: "${genre || 'Not specified'}"
        - Artist: "${artist || 'Not specified'}"

        Validation Rules:
        1. If ANY of the provided fields (Mood, Genre, or Artist) contain gibberish (e.g., "asdf", "12345"), random characters, or topics completely unrelated to music/emotions, set "isValid" to false.
        2. If the "Genre" is specified but is not a real music genre, set "isValid" to false.
        3. If the "Artist" is specified but is clearly not a real musical artist or band, set "isValid" to false.
        4. If "isValid" is false, provide a clear explanation in "errorReason" in Hebrew (e.g., "הז'אנר שהזנת אינו קיים").

        If ALL inputs are valid:
        - Set "isValid" to true.
        - Generate a list of ${songCount || 20} songs that match the mood "${mood}".
        - ${genre ? `The songs must be from the "${genre}" genre.` : ''}
        - ${artist ? `Include songs by or very similar to "${artist}".` : ''}
        - ${startYear && endYear ? `Songs must be released between ${startYear} and ${endYear}.` : ''}
    `;
}

async function generatePlaylistContent(params) {
    const model = genAI.getGenerativeModel({
        model: GEMINI.MODEL,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA
        }
    });

    const prompt = buildPrompt(params);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return JSON.parse(text);
}

module.exports = {
    generatePlaylistContent
};
