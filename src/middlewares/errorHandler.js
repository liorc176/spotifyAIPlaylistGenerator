function errorHandler(err, req, res, next) {
    console.error('Unhandled Error:', err.message || err);

    // Handle Gemini 429 rate limit errors specifically
    if (err.status === 429 || (err.message && err.message.includes('429'))) {
        return res.status(429).json({
            error: 'system is overloaded, please try agin in 60 seconds'
        });
    }

    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: message,
        ...(err.details && { details: err.details })
    });
}

module.exports = errorHandler;
