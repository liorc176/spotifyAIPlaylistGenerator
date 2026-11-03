const axios = require('axios');
const { SPOTIFY } = require('../config/env');

const ACCOUNTS_BASE_URL = 'https://accounts.spotify.com';
const API_BASE_URL = 'https://api.spotify.com/v1';

function getBasicAuthHeader() {
    const credentials = `${SPOTIFY.CLIENT_ID}:${SPOTIFY.CLIENT_SECRET}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

function getAuthorizeUrl(state) {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY.CLIENT_ID,
        scope: SPOTIFY.SCOPE,
        redirect_uri: SPOTIFY.REDIRECT_URI,
        state: state,
        show_dialog: 'true'
    });
    return `${ACCOUNTS_BASE_URL}/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
    const params = new URLSearchParams({
        code: code,
        redirect_uri: SPOTIFY.REDIRECT_URI,
        grant_type: 'authorization_code'
    });

    const response = await axios.post(`${ACCOUNTS_BASE_URL}/api/token`, params, {
        headers: {
            'Authorization': getBasicAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    return response.data;
}

async function refreshAccessToken(refreshToken) {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    const response = await axios.post(`${ACCOUNTS_BASE_URL}/api/token`, params, {
        headers: {
            'Authorization': getBasicAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    return response.data;
}

async function getCurrentUserProfile(accessToken) {
    const response = await axios.get(`${API_BASE_URL}/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.data;
}

async function searchTrackUri(track, artist, accessToken) {
    try {
        const query = `track:${track} artist:${artist}`;
        const response = await axios.get(`${API_BASE_URL}/search`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: {
                q: query,
                type: 'track',
                limit: 1
            }
        });

        const items = response.data?.tracks?.items;
        if (items && items.length > 0) {
            return items[0].uri;
        }
        return null;
    } catch (error) {
        console.error(`Failed Spotify search for track "${track}":`, error.message);
        return null;
    }
}

async function searchTracksConcurrently(songs, accessToken) {
    const searchPromises = songs.map(song => 
        searchTrackUri(song.track, song.artist, accessToken)
    );
    const results = await Promise.all(searchPromises);
    return results.filter(uri => Boolean(uri));
}

async function createPlaylist(userId, name, description, accessToken) {
    const response = await axios.post(
        `${API_BASE_URL}/users/${userId}/playlists`,
        {
            name: name,
            description: description || "Created by AI playlist generator 🤖",
            public: true
        },
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    return response.data;
}

async function addTracksToPlaylist(playlistId, uris, accessToken) {
    const response = await axios.post(
        `${API_BASE_URL}/playlists/${playlistId}/tracks`,
        { uris: uris },
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    return response.data;
}

async function renamePlaylist(spotifyPlaylistId, newName, accessToken) {
    const response = await axios.put(
        `${API_BASE_URL}/playlists/${spotifyPlaylistId}`,
        { name: newName },
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    return response.data;
}

async function unfollowPlaylist(spotifyPlaylistId, accessToken) {
    const response = await axios.delete(
        `${API_BASE_URL}/playlists/${spotifyPlaylistId}/followers`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    return response.data;
}

module.exports = {
    getAuthorizeUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    getCurrentUserProfile,
    searchTrackUri,
    searchTracksConcurrently,
    createPlaylist,
    addTracksToPlaylist,
    renamePlaylist,
    unfollowPlaylist
};
