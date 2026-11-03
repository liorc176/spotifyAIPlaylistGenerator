const rateLimit = require('express-rate-limit');

const playlistLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5,                   // 5 requests per window
    message: { 
        error: 'You have exceeded the number of requests, please try again in 10 minutes.',
        errorType: 'SERVER_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    playlistLimiter
};
