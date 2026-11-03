const app = require('../src/app');
const { PORT } = require('../src/config/env');

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Spotify AI Playlist Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
