const crypto = require('crypto');
const spotifyClient = require('../integrations/spotify.client');
const userRepository = require('../repositories/user.repository');

function generateRandomString(length = 16) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function createLoginUrl(session) {
    const state = generateRandomString(16);
    session.state = state;
    return spotifyClient.getAuthorizeUrl(state);
}

async function handleOAuthCallback(code, state, storedState) {
    if (!state || state !== storedState) {
        const error = new Error('State mismatch');
        error.code = 'state_mismatch';
        throw error;
    }

    try {
        const tokenData = await spotifyClient.exchangeCodeForTokens(code);
        const userProfile = await spotifyClient.getCurrentUserProfile(tokenData.access_token);

        try {
            await userRepository.upsertUser(userProfile.id, userProfile.display_name);
            console.log(`User ${userProfile.display_name} saved/updated in DB.`);
        } catch (dbErr) {
            console.error('Error saving user to DB:', dbErr.message);
        }

        return {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000),
            userId: userProfile.id,
            userName: userProfile.display_name
        };
    } catch (error) {
        console.error('Error during token exchange:', error.response?.data || error.message);
        const authError = new Error('Invalid token exchange');
        authError.code = 'invalid_token';
        throw authError;
    }
}

async function checkAndRefreshToken(session) {
    if (!session.access_token || !session.refresh_token) {
        return { authenticated: false };
    }

    const currentTime = Date.now();
    const tokenExpiration = session.expires_at || 0;

    if (currentTime > tokenExpiration - (5 * 60 * 1000)) {
        console.log('Token is expired or expiring soon. Refreshing...');
        try {
            const refreshed = await spotifyClient.refreshAccessToken(session.refresh_token);
            session.access_token = refreshed.access_token;
            if (refreshed.refresh_token) {
                session.refresh_token = refreshed.refresh_token;
            }
            session.expires_at = Date.now() + (refreshed.expires_in * 1000);
            console.log('Token refreshed successfully!');
        } catch (error) {
            console.error('Failed to refresh token:', error.message);
            session.destroy();
            return { authenticated: false };
        }
    }

    return {
        authenticated: true,
        user: session.userName
    };
}

module.exports = {
    generateRandomString,
    createLoginUrl,
    handleOAuthCallback,
    checkAndRefreshToken
};
