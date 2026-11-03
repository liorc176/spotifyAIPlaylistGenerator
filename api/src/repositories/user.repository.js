const { dbPool } = require('../config/db');

async function upsertUser(userId, displayName) {
    const query = `
        INSERT INTO users (user_id, display_name) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE display_name = ?
    `;
    const [result] = await dbPool.query(query, [userId, displayName, displayName]);
    return result;
}

module.exports = {
    upsertUser
};
