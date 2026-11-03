const mysql = require('mysql2/promise');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { DB } = require('./env');

const dbPool = mysql.createPool({
    host: DB.HOST,
    user: DB.USER,
    password: DB.PASSWORD,
    database: DB.NAME,
    port: DB.PORT,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 mins
    expiration: 86400000             // 1 day
}, dbPool);

async function testDbConnection() {
    try {
        const connection = await dbPool.getConnection();
        console.log('✅ Successfully connected to MySQL / TiDB database!');
        connection.release();
    } catch (error) {
        console.error('❌ Error connecting to MySQL database:', error.message);
    }
}

module.exports = {
    dbPool,
    sessionStore,
    testDbConnection
};
