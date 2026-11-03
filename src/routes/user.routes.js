const express = require('express');
const router = express.Router();
const { getStats, getPlaylists, renamePlaylist, deletePlaylist } = require('../controllers/user.controller');
const requireAuth = require('../middlewares/requireAuth');

// All user routes require authentication
router.use(requireAuth);

router.get('/stats', getStats);
router.get('/playlists', getPlaylists);
router.put('/playlist/:id', renamePlaylist);
router.delete('/playlist/:id', deletePlaylist);

module.exports = router;
