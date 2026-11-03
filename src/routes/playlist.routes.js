const express = require('express');
const router = express.Router();
const { generate, savePlaylist } = require('../controllers/playlist.controller');
const { playlistLimiter } = require('../middlewares/rateLimiter');
const requireAuth = require('../middlewares/requireAuth');

router.post('/generate', playlistLimiter, generate);
router.post('/save-playlist', requireAuth, savePlaylist);

module.exports = router;
