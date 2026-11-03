const geminiClient = require('../integrations/gemini.client');
const spotifyClient = require('../integrations/spotify.client');
const playlistRepository = require('../repositories/playlist.repository');

async function generatePlaylistContent(params) {
    return await geminiClient.generatePlaylistContent(params);
}

async function savePlaylistToSpotify({ userId, accessToken, songs, mood, playlistName, genre, artist, songCount }) {
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
        const err = new Error('Invalid songs data');
        err.statusCode = 400;
        throw err;
    }

    // 1. Search tracks concurrently
    const trackURIs = await spotifyClient.searchTracksConcurrently(songs, accessToken);

    if (trackURIs.length === 0) {
        const err = new Error('No songs were found on Spotify');
        err.statusCode = 404;
        throw err;
    }

    // 2. Create playlist on Spotify
    const finalName = playlistName || `AI Mood: ${mood}`;
    const newPlaylist = await spotifyClient.createPlaylist(
        userId,
        finalName,
        "Created by AI playlist generator 🤖",
        accessToken
    );

    const playlistId = newPlaylist.id;
    const playlistUrl = newPlaylist.external_urls.spotify;

    // 3. Add tracks to playlist
    await spotifyClient.addTracksToPlaylist(playlistId, trackURIs, accessToken);

    // 4. Save to our database
    try {
        await playlistRepository.savePlaylistRecord({
            userId,
            playlistId,
            playlistName: finalName,
            playlistUrl,
            mood,
            genre,
            artist,
            songCount: songCount || songs.length
        });
        console.log(`Playlist stats saved to DB for user ID: ${userId}`);
    } catch (dbErr) {
        console.error('Error saving playlist record to DB:', dbErr.message);
    }

    return {
        playlistId,
        playlistUrl
    };
}

module.exports = {
    generatePlaylistContent,
    savePlaylistToSpotify
};
