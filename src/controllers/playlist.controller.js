const playlistService = require('../services/playlist.service');

async function generate(req, res, next) {
    const { mood, genre, artist, startYear, endYear, songCount = 20 } = req.body;

    if (!mood) {
        return res.status(400).json({ error: 'Mood is required' });
    }

    try {
        const parsedData = await playlistService.generatePlaylistContent({
            mood,
            genre,
            artist,
            startYear,
            endYear,
            songCount
        });

        if (!parsedData.isValid) {
            console.log(`Gemini rejected the input: ${parsedData.errorReason}`);
            return res.status(400).json({
                error: "input is not valid, please try again",
                details: parsedData.errorReason
            });
        }

        res.json(parsedData);
    } catch (error) {
        next(error);
    }
}

async function savePlaylist(req, res, next) {
    if (!req.session.access_token) {
        return res.status(401).json({ error: 'User not logged in' });
    }

    const { songs, mood, playlistName, genre, artist, songCount } = req.body;

    try {
        const result = await playlistService.savePlaylistToSpotify({
            userId: req.session.userId,
            accessToken: req.session.access_token,
            songs,
            mood,
            playlistName,
            genre,
            artist,
            songCount
        });

        res.json({
            success: true,
            playlistUrl: result.playlistUrl,
            playlistId: result.playlistId
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    generate,
    savePlaylist
};
