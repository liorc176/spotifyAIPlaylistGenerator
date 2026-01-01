const express = require('express');
const session = require('express-session'); 
const path = require('path');
const axios = require('axios');
const { log } = require('console');
const app = express();
const port = 3000;
require('dotenv').config({path: path.join(__dirname, '..', 'codes.env') });
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const scope = 'playlist-modify-public playlist-modify-private user-read-private user-read-email';

clientPath=path.join(__dirname,'..', 'client')
app.use(express.static(clientPath));
console.log('SESSION_SECRET loaded:', process.env.SESSION_SECRET);
app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
}));

app.get('/', (req, res) => {
    
    res.sendFile(path.join(clientPath, 'index.html'));
});

app.get('/generatePlaylist', (req, res) => {
    
    res.sendFile(path.join(clientPath, 'generatePlaylist.html'));
});

app.get('/login', (req, res) => {
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
    const expire_at = req.session.expires_in || null;
    if (state === null || state !== storedState) {
        return res.redirect('/#' + new URLSearchParams({ error: 'state_mismatch' }).toString());
    }

    delete req.session.state;

    try {
        const params = new URLSearchParams();
        params.append('code', code);
        params.append('redirect_uri', process.env.SPOTIFY_REDIRECT_URI);
        params.append('grant_type', 'authorization_code');

        const authOptions = {
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            } 
        };

        const response = await axios.post('https://accounts.spotify.com/api/token', params, authOptions);

        if (response.status === 200) {
            req.session.access_token = response.data.access_token;
            req.session.refresh_token = response.data.refresh_token;
            req.session.expires_at = Date.now() + (response.data.expires_in * 1000);        
            try {
                const userResponse = await axios.get('https://api.spotify.com/v1/me', {
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
    
    if (currentTime > tokenExpiration - (5 * 60 * 1000)) {
        console.log('Token is expired or expiring soon. Refreshing...');
        
        try {
            const data = await refreshAccessToken(req.session.refresh_token);

            req.session.access_token = data.access_token;
            if (data.refresh_token) req.session.refresh_token = data.refresh_token;
            
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

const generateRandomString = (length) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};
app.listen(port, () => {
    console.log('Server listening at http://127.0.0.1:' +port);
});