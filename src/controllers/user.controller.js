const userService = require('../services/user.service');

async function getStats(req, res, next) {
    try {
        const stats = await userService.getUserStats(req.session.userId);
        res.json(stats);
    } catch (error) {
        next(error);
    }
}

async function getPlaylists(req, res, next) {
    const limit = parseInt(req.query.limit, 10) || 4;
    const offset = parseInt(req.query.offset, 10) || 0;

    try {
        const result = await userService.getUserPlaylists(req.session.userId, limit, offset);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function renamePlaylist(req, res, next) {
    const dbId = req.params.id;
    const { spotifyPlaylistId, newName } = req.body;

    try {
        const result = await userService.renamePlaylist({
            dbId,
            userId: req.session.userId,
            spotifyPlaylistId,
            newName,
            accessToken: req.session.access_token
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function deletePlaylist(req, res, next) {
    const dbId = req.params.id;
    const { spotifyPlaylistId, deleteType } = req.body;

    try {
        const result = await userService.deletePlaylist({
            dbId,
            userId: req.session.userId,
            spotifyPlaylistId,
            deleteType,
            accessToken: req.session.access_token
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getStats,
    getPlaylists,
    renamePlaylist,
    deletePlaylist
};
