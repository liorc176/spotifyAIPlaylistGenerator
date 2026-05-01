const express = require('express');
const session = require('express-session'); 
const path = require('path');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { log } = require('console');
const mysql = require('mysql2/promise');
const MySQLStore = require('express-mysql-session')(session);
const app = express();
require('dotenv').config();
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const scope = 'playlist-modify-public playlist-modify-private user-read-private user-read-email';

app.use(express.json());
console.log('SESSION_SECRET loaded:', process.env.SESSION_SECRET);



const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000, 
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true 
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000
}, dbPool);

app.use(session({
    key: 'spotify_ai_session',
    secret: process.env.SESSION_SECRET,
    store: sessionStore, 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

async function testDbConnection() {
    try {
        const connection = await dbPool.getConnection();
        console.log('✅ Successfully connected to TIDB MySQL database!');
        connection.release();
    } catch (error) {
        console.error('❌ Error connecting to MySQL database:', error.message);
    }
}

testDbConnection();

app.get('/login', (req, res) => {//directing the client to login in Spotify
    const state = generateRandomString(16); 
    req.session.state = state; 
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: scope,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        state: state,
        show_dialog: 'true'
    }).toString();
    res.redirect('https://accounts.spotify.com/authorize?' + params);
});


app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.session.state || null;
    if (state === null || state !== storedState) {//check if the state that came back from spotify is the same as stored
        return res.redirect('/#' + new URLSearchParams({ error: 'state_mismatch' }).toString());
    }

    delete req.session.state;

    try {
        const params = new URLSearchParams();//strat building request for access token
        params.append('code', code);
        params.append('redirect_uri', process.env.SPOTIFY_REDIRECT_URI);
        params.append('grant_type', 'authorization_code');

        const authOptions = {
            headers: {//encode client ID and secret
                'Authorization': 'Basic ' + (Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            } 
        };

        const response = await axios.post('https://accounts.spotify.com/api/token', params, authOptions);//access token request directly from spotify server

        if (response.status === 200) {
            req.session.access_token = response.data.access_token;
            req.session.refresh_token = response.data.refresh_token;
            req.session.expires_at = Date.now() + (response.data.expires_in * 1000); //time is in msec      
            try {
                const userResponse = await axios.get('https://api.spotify.com/v1/me', {//get username from spotify
                    headers: {
                        'Authorization': 'Bearer ' + req.session.access_token
                    }
                });

                req.session.userName = userResponse.data.display_name;
                req.session.userId = userResponse.data.id; 
                console.log(`Successfully logged in as: ${req.session.userName}`);
                try {
                    await dbPool.query(
                        `INSERT INTO users (user_id, display_name) VALUES (?, ?) 
                        ON DUPLICATE KEY UPDATE display_name = ?`,
                        [req.session.userId, req.session.userName, req.session.userName]
                    );
                    console.log(`User ${req.session.userName} saved/updated in DB.`);
                } catch (dbErr) {
                    console.error('Error saving user to DB:', dbErr.message);
                }
            } 
            catch (userError) {
                console.error('Error fetching user profile:', userError.message);
            }

            res.redirect('/');
        }
    } catch (error) {
        console.error('Error during token exchange:', error.response?.data || error.message);
        res.redirect('/#' + new URLSearchParams({ error: 'invalid_token' }).toString());
    }
});

async function refreshAccessToken(refreshToken) {
    const authOptions = {
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')),
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    const response = await axios.post('https://accounts.spotify.com/api/token', params, authOptions);
    return response.data;
}

app.get('/check-auth', async (req, res) => {
    if (!req.session.access_token || !req.session.refresh_token) {
        return res.json({ authenticated: false });
    }

    const currentTime = Date.now();
    const tokenExpiration = req.session.expires_at || 0;
    
    if (currentTime > tokenExpiration - (5 * 60 * 1000)) {//token expire or have less then 5 minuets
        console.log('Token is expired or expiring soon. Refreshing...');
        
        try {
            const data = await refreshAccessToken(req.session.refresh_token);//using made helper function to refresh the token

            req.session.access_token = data.access_token;
            if (data.refresh_token) //if refresh token replaced
                req.session.refresh_token = data.refresh_token;
            
            req.session.expires_at = Date.now() + (data.expires_in * 1000);
            
            console.log('Token refreshed successfully!');
        } catch (error) {
            console.error('Failed to refresh token:', error.message);
            req.session.destroy();
            return res.json({ authenticated: false });
        }
    }

    res.json({ 
        authenticated: true, 
        user: req.session.userName 
    });
});

const generateRandomString = (length) => {//randomize a long string for 'state' parameter when redirecting to spotify 
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};
const playlistLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // time limit
    max: 5, // max request at that time
    message: { 
        error: 'You have exceeded the number of requests, please try again in 10 minutes.',
        errorType: 'SERVER_LIMIT'
     },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/generate',playlistLimiter, async (req, res) => {
    const { mood, genre, artist, startYear, endYear, songCount = 20 } = req.body;    

    if (!mood) return res.status(400).json({ error: 'Mood is required' });

    try {
        const responseSchema = {
            type: "object",
            properties: {
                isValid: { type: "boolean" }, // האם הקלט תקין?
                errorReason: { type: "string", nullable: true }, // למה לא תקין?
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

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { 
                responseMimeType: "application/json",
                responseSchema: responseSchema 
            } 
        });
        let prompt = `
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
            - Generate a list of ${songCount} songs that match the mood "${mood}".
            - ${genre ? `The songs must be from the "${genre}" genre.` : ''}
            - ${artist ? `Include songs by or very similar to "${artist}".` : ''}
            - ${startYear && endYear ? `Songs must be released between ${startYear} and ${endYear}.` : ''}
            `;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const parsedData = JSON.parse(text);
        if (!parsedData.isValid) {
            console.log(`Gemini rejected the input: ${parsedData.errorReason}`);
            return res.status(400).json({ 
                error:"input is not valid, please try again",
                details: parsedData.errorReason
            });
        }
        res.json(parsedData);
    }

    catch (error) {
        console.error('Gemini Error:', error);
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return res.status(429).json({ 
                error: 'system is overloaded, please try agin in 60 seconds',
            });
            }

        res.status(500).json({ error: 'Failed to generate playlist' });

    }
    
});

app.post('/save-playlist', async (req, res) => {
    if (!req.session.access_token) {//check auth
        return res.status(401).json({ error: 'User not logged in' });
    }

    const { songs, mood, playlistName, genre, artist, songCount } = req.body;
    if (!songs || !Array.isArray(songs)) {//check validity of array
        return res.status(400).json({ error: 'Invalid songs data' });
    }

    console.log(`Starting to create playlist for user: ${req.session.userName}`);

    try {
        const trackURIs = [];

        for (const song of songs) {//searchhing all the songs from gemini in spotify
            try {
                const query = `track:${song.track} artist:${song.artist}`;//search by song and artist
                
                const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
                    headers: { 'Authorization': 'Bearer ' + req.session.access_token },
                    params: {
                        q: query,
                        type: 'track',
                        limit: 1 
                    }
                });

                if (searchResponse.data.tracks.items.length > 0) {
                    const uri = searchResponse.data.tracks.items[0].uri;
                    trackURIs.push(uri);
                } else {
                    console.log(`Song not found: ${song.track} by ${song.artist}`);
                }
            } catch (err) {
                console.error(`Failed search for ${song.track}:`, err.message);
            }
        }

        if (trackURIs.length === 0) {
            return res.status(404).json({ error: 'No songs were found on Spotify' });
        }

        //create new empty playlist
        const userId = req.session.userId;        
        const playlistResponse = await axios.post(`https://api.spotify.com/v1/users/${userId}/playlists`, 
            {
                name: playlistName || `AI Mood: ${mood}`,
                description: "Created by AI playlist generator 🤖",
                public: true 
            },
            { headers: { 'Authorization': 'Bearer ' + req.session.access_token } }
        );
        
        const playlistId = playlistResponse.data.id;
        const playlistUrl = playlistResponse.data.external_urls.spotify;
        console.log('playlistId:' +playlistId);
        
        //add songs to the empty playlist
        await axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
            { uris: trackURIs },
            { headers: { 'Authorization': 'Bearer ' + req.session.access_token } }
        );

        console.log(`Playlist created! URL: ${playlistUrl}`);

        try {
            await dbPool.query(
                `INSERT INTO generated_Playlists 
                (user_id, spotify_playlist_id, playlist_name, spotify_url, prompt_mood, prompt_genre, prompt_artist, song_count) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.session.userId, 
                    playlistId, 
                    playlistName, 
                    playlistUrl, 
                    mood, 
                    genre || null,
                    artist || null, 
                    songCount || songs.length 
                ]
            );
            console.log(`Playlist stats saved to DB for user ${req.session.userName}`);
        } catch (dbErr) {
            console.error('Error saving playlist to DB:', dbErr.message);
        }
        
        res.json({ success: true, playlistUrl: playlistUrl, playlistId: playlistId });
    } catch (error) {
        console.error('Error creating playlist:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create playlist on Spotify' });
    }
});
app.get('/api/user/stats', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const userId = req.session.userId;

        const [totalRes] = await dbPool.query('SELECT COUNT(*) as count FROM generated_Playlists WHERE user_id = ?', [userId]);

        const [moodRes] = await dbPool.query('SELECT prompt_mood, COUNT(*) as count FROM generated_Playlists WHERE user_id = ? AND prompt_mood IS NOT NULL GROUP BY prompt_mood ORDER BY count DESC LIMIT 1', [userId]);

        const [genreRes] = await dbPool.query('SELECT prompt_genre, COUNT(*) as count FROM generated_Playlists WHERE user_id = ? AND prompt_genre IS NOT NULL AND prompt_genre != "" GROUP BY prompt_genre ORDER BY count DESC LIMIT 1', [userId]);

        const [artistRes] = await dbPool.query('SELECT prompt_artist, COUNT(*) as count FROM generated_Playlists WHERE user_id = ? AND prompt_artist IS NOT NULL AND prompt_artist != "" GROUP BY prompt_artist ORDER BY count DESC LIMIT 1', [userId]);

        res.json({
            totalPlaylists: totalRes[0].count,
            
            topMood: moodRes.length > 0 ? moodRes[0].prompt_mood : '-',
            topMoodCount: moodRes.length > 0 ? moodRes[0].count : 0,
            topGenre: genreRes.length > 0 ? genreRes[0].prompt_genre : '-',
            topGenreCount: genreRes.length > 0 ? genreRes[0].count : 0,             
            topArtist: artistRes.length > 0 ? artistRes[0].prompt_artist : '-',
            topArtistCount: artistRes.length > 0 ? artistRes[0].count : 0
        });
    } catch (error) {
        console.error('Error fetching stats:', error.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/user/playlists', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const userId = req.session.userId;
        const limit = parseInt(req.query.limit) || 4; 
        const offset = parseInt(req.query.offset) || 0;

        const [playlists] = await dbPool.query(
            `SELECT id,spotify_playlist_id, playlist_name, spotify_url 
             FROM generated_Playlists 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ${limit} OFFSET ${offset}`,
            [userId]
        );

        const [countRes] = await dbPool.query('SELECT COUNT(*) as total FROM Generated_Playlists WHERE user_id = ?', [userId]);
        const totalPlaylists = countRes[0].total;
        
        const hasMore = (offset + playlists.length) < totalPlaylists;

        res.json({
            playlists: playlists,
            hasMore: hasMore
        });
    } catch (error) {
        console.error('Error fetching playlists:', error.message);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

app.put('/api/user/playlist/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const dbId = req.params.id;
    const { spotifyPlaylistId, newName } = req.body;

    try {
        await axios.put(`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}`, 
            { name: newName },
            { headers: { 'Authorization': 'Bearer ' + req.session.access_token } }
        );

        await dbPool.query(
            'UPDATE generated_Playlists SET playlist_name = ? WHERE id = ? AND user_id = ?',
            [newName, dbId, req.session.userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error renaming playlist:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to rename playlist' });
    }
});

app.delete('/api/user/playlist/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const dbId = req.params.id;
    const { spotifyPlaylistId, deleteType } = req.body; 

    try {
        if (deleteType === 'both') {
            await axios.delete(`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/followers`, {
                headers: { 'Authorization': 'Bearer ' + req.session.access_token }
            });
        }

        await dbPool.query(
            'DELETE FROM generated_Playlists WHERE id = ? AND user_id = ?',
            [dbId, req.session.userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting playlist:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});

module.exports = app;