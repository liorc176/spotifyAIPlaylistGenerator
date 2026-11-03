const { dbPool } = require('../config/db');

async function savePlaylistRecord({ userId, playlistId, playlistName, playlistUrl, mood, genre, artist, songCount }) {
    const query = `
        INSERT INTO generated_Playlists 
        (user_id, spotify_playlist_id, playlist_name, spotify_url, prompt_mood, prompt_genre, prompt_artist, song_count) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
        userId,
        playlistId,
        playlistName,
        playlistUrl,
        mood,
        genre || null,
        artist || null,
        songCount
    ];
    const [result] = await dbPool.query(query, values);
    return result;
}

async function getUserStats(userId) {
    const [totalRes] = await dbPool.query(
        'SELECT COUNT(*) as count FROM generated_Playlists WHERE user_id = ?',
        [userId]
    );

    const [moodRes] = await dbPool.query(
        `SELECT prompt_mood, COUNT(*) as count 
         FROM generated_Playlists 
         WHERE user_id = ? AND prompt_mood IS NOT NULL 
         GROUP BY prompt_mood ORDER BY count DESC LIMIT 1`,
        [userId]
    );

    const [genreRes] = await dbPool.query(
        `SELECT prompt_genre, COUNT(*) as count 
         FROM generated_Playlists 
         WHERE user_id = ? AND prompt_genre IS NOT NULL AND prompt_genre != "" 
         GROUP BY prompt_genre ORDER BY count DESC LIMIT 1`,
        [userId]
    );

    const [artistRes] = await dbPool.query(
        `SELECT prompt_artist, COUNT(*) as count 
         FROM generated_Playlists 
         WHERE user_id = ? AND prompt_artist IS NOT NULL AND prompt_artist != "" 
         GROUP BY prompt_artist ORDER BY count DESC LIMIT 1`,
        [userId]
    );

    return {
        totalPlaylists: totalRes[0]?.count || 0,
        topMood: moodRes.length > 0 ? moodRes[0].prompt_mood : '-',
        topMoodCount: moodRes.length > 0 ? moodRes[0].count : 0,
        topGenre: genreRes.length > 0 ? genreRes[0].prompt_genre : '-',
        topGenreCount: genreRes.length > 0 ? genreRes[0].count : 0,
        topArtist: artistRes.length > 0 ? artistRes[0].prompt_artist : '-',
        topArtistCount: artistRes.length > 0 ? artistRes[0].count : 0
    };
}

async function getPlaylistsByUserId(userId, limit, offset) {
    const safeLimit = Math.max(1, parseInt(limit, 10) || 4);
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

    const [playlists] = await dbPool.query(
        `SELECT id, spotify_playlist_id, playlist_name, spotify_url 
         FROM generated_Playlists 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [userId, safeLimit, safeOffset]
    );

    const [countRes] = await dbPool.query(
        'SELECT COUNT(*) as total FROM generated_Playlists WHERE user_id = ?',
        [userId]
    );

    const totalPlaylists = countRes[0]?.total || 0;
    const hasMore = (safeOffset + playlists.length) < totalPlaylists;

    return {
        playlists,
        hasMore
    };
}

async function updatePlaylistName(dbId, userId, newName) {
    const query = 'UPDATE generated_Playlists SET playlist_name = ? WHERE id = ? AND user_id = ?';
    const [result] = await dbPool.query(query, [newName, dbId, userId]);
    return result;
}

async function deletePlaylist(dbId, userId) {
    const query = 'DELETE FROM generated_Playlists WHERE id = ? AND user_id = ?';
    const [result] = await dbPool.query(query, [dbId, userId]);
    return result;
}

module.exports = {
    savePlaylistRecord,
    getUserStats,
    getPlaylistsByUserId,
    updatePlaylistName,
    deletePlaylist
};
