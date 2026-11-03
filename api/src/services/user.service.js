const playlistRepository = require('../repositories/playlist.repository');
const spotifyClient = require('../integrations/spotify.client');

async function getUserStats(userId) {
    return await playlistRepository.getUserStats(userId);
}

async function getUserPlaylists(userId, limit, offset) {
    return await playlistRepository.getPlaylistsByUserId(userId, limit, offset);
}

async function renamePlaylist({ dbId, userId, spotifyPlaylistId, newName, accessToken }) {
    if (!newName || !newName.trim()) {
        const err = new Error('Name cannot be empty');
        err.statusCode = 400;
        throw err;
    }

    await spotifyClient.renamePlaylist(spotifyPlaylistId, newName, accessToken);
    await playlistRepository.updatePlaylistName(dbId, userId, newName);

    return { success: true };
}

async function deletePlaylist({ dbId, userId, spotifyPlaylistId, deleteType, accessToken }) {
    if (deleteType === 'both') {
        await spotifyClient.unfollowPlaylist(spotifyPlaylistId, accessToken);
    }

    await playlistRepository.deletePlaylist(dbId, userId);

    return { success: true };
}

module.exports = {
    getUserStats,
    getUserPlaylists,
    renamePlaylist,
    deletePlaylist
};
