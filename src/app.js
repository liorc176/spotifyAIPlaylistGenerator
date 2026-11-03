const express = require('express');
const session = require('express-session');
const { SESSION_SECRET } = require('./config/env');
const { sessionStore, testDbConnection } = require('./config/db');

// Route modules
const authRoutes = require('./routes/auth.routes');
const playlistRoutes = require('./routes/playlist.routes');
const userRoutes = require('./routes/user.routes');

// Error handling middleware
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Session middleware with MySQL store
app.use(session({
    key: 'spotify_ai_session',
    secret: SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Test database connection on startup
testDbConnection();

// Mount Routes
app.use('/', authRoutes);
app.use('/', playlistRoutes);
app.use('/api/user', userRoutes);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
