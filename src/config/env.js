require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'fallback_session_secret_spotify_ai',
    SPOTIFY: {
        CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
        CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
        REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
        SCOPE: 'playlist-modify-public playlist-modify-private user-read-private user-read-email'
    },
    GEMINI: {
        API_KEY: process.env.GEMINI_API_KEY,
        MODEL: 'gemini-2.5-flash'
    },
    DB: {
        HOST: process.env.DB_HOST,
        USER: process.env.DB_USER,
        PASSWORD: process.env.DB_PASSWORD,
        NAME: process.env.DB_NAME,
        PORT: Number(process.env.DB_PORT) || 4000
    }
};
