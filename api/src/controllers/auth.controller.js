const authService = require('../services/auth.service');

function login(req, res) {
    const authorizeUrl = authService.createLoginUrl(req.session);
    res.redirect(authorizeUrl);
}

async function callback(req, res) {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.session.state || null;

    delete req.session.state;

    try {
        const authResult = await authService.handleOAuthCallback(code, state, storedState);

        req.session.access_token = authResult.accessToken;
        req.session.refresh_token = authResult.refreshToken;
        req.session.expires_at = authResult.expiresAt;
        req.session.userId = authResult.userId;
        req.session.userName = authResult.userName;

        res.redirect('/');
    } catch (error) {
        const errorCode = error.code || 'invalid_token';
        res.redirect('/#' + new URLSearchParams({ error: errorCode }).toString());
    }
}

async function checkAuth(req, res) {
    const result = await authService.checkAndRefreshToken(req.session);
    res.json(result);
}

module.exports = {
    login,
    callback,
    checkAuth
};
