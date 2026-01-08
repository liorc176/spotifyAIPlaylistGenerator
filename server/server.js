const express = require('express');
const session = require('express-session'); 
const path = require('path');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { log } = require('console');
const app = express();
const port = 3000;
require('dotenv').config({path: path.join(__dirname, '..', '.env') });
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const scope = 'playlist-modify-public playlist-modify-private user-read-private user-read-email';

const clientPath=path.join(__dirname,'..', 'client')
app.use(express.static(clientPath));
app.use(express.json());
console.log('SESSION_SECRET loaded:', process.env.SESSION_SECRET);
app.use(session({//creates a cookie to verify user auth
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
}));





app.get('/', (req, res) => {//server will load index.html when starting
    
    res.sendFile(path.join(clientPath, 'index.html'));
});

app.get('/generatePlaylist', (req, res) => {
    
    res.sendFile(path.join(clientPath, 'generatePlaylist.html'));
});

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
    if (state === null || state !== storedState) {//check if the state that came back from spotify is tha same as stored
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
            if (data.refresh_token) //if got new refresh token instead
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
                songs: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            artist: { type: "string" },
                            track: { type: "string" }
                        },
                        required: ["artist", "track"] // מבטיח שכל שיר יכיל את שניהם
                    }
                }
            },
            required: ["songs"]
        };

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { 
                responseMimeType: "application/json",
                responseSchema: responseSchema 
            } 
        });
        prompt = `Create a list of ${songCount} songs based on this mood/activity: "${mood}".`;
        if (genre) {
            prompt += ` The songs should be in the "${genre}" genre.`;
        }
        if (artist) {
            prompt += ` Prefer including songs by or similar to the artist "${artist}".`;
        }
        if (startYear && endYear) {
            prompt += ` The songs must be released between the years ${startYear} and ${endYear}.`;
        }
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const parsedData = JSON.parse(text);
        res.json(parsedData);

    } catch (error) {
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

    const { songs, mood, playlistName } = req.body;
    
    if (!songs || !Array.isArray(songs)) {//check validity of array
        return res.status(400).json({ error: 'Invalid songs data' });
    }

    console.log(`Starting to create playlist for user: ${req.session.userName}`);

    try {
        const trackURIs = [];

        for (const song of songs) {//searchhing all the songs from gemini in spotify
            try {
                const query = `track:${song.track} artist:${song.artist}`;//search by song and artist
                
                const searchResponse = await axios.get('http://api.spotify.com/v1/search', {
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
                public: false 
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
        
        res.json({ success: true, playlistUrl: playlistUrl });//send link to client

    } catch (error) {
        console.error('Error creating playlist:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create playlist on Spotify' });
    }
});


app.listen(port, () => {
    console.log('Server listening at http://127.0.0.1:' +port);
});