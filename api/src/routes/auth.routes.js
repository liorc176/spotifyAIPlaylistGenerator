const express = require('express');
const router = express.Router();
const { login, callback, checkAuth } = require('../controllers/auth.controller');

router.get('/login', login);
router.get('/callback', callback);
router.get('/check-auth', checkAuth);

module.exports = router;
