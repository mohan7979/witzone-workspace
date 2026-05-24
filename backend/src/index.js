require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { sequelize, User } = require('./models');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
});

// Security & parsing
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(morgan('combined'));
app.set('trust proxy', 1);

// Rate limiting
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { message: 'Too many login attempts' } }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/users', require('./routes/users'));
app.use('/api/idle', require('./routes/idle'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/master',        require('./routes/master'));
app.use('/api/announcements', require('./routes/announcements'));

app.get('/health', (_, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// Socket.io: authenticate every connection with a JWT token
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'role', 'status'] });
    if (!user || user.status !== 'active') return next(new Error('Invalid token'));
    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// Socket.io: broadcast idle updates to HR dashboards
io.on('connection', (socket) => {
  const isHR = socket.user?.role === 'hr' || socket.user?.role === 'lead';
  // Only HR/leads can subscribe to the HR room or emit idle events
  socket.on('join_hr', () => { if (isHR) socket.join('hr_room'); });
  socket.on('idle_event', (data) => { if (isHR) io.to('hr_room').emit('employee_idle', data); });
});
app.set('io', io);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

sequelize.authenticate().then(() => {
  console.log('Database connected');
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
  console.error('Database connection failed:', err);
  process.exit(1);
});

// Graceful shutdown — lets nodemon cleanly release the port before restarting
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully`);
  httpServer.close(() => {
    console.log('HTTP server closed');
    sequelize.close().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000); // force-kill after 5s if stuck
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
