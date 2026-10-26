import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import notificationRoutes from './routes/notificationRoutes.js';

app.use('/api', notificationRoutes);

const server = http.createServer(app);
const PORT = Number(process.env.PORT || 5000);

const startServer = (port) => {
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Test the API with:');
    console.log(`curl -X POST http://localhost:${port}/api/notifications -H "Content-Type: application/json" -d "{\\"message\\": \\"Hello\\", \\"userId\\": \\"123\\", \\"type\\": \\"in-app\\"}"`);
  });
};

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const fallbackPort = PORT + 1;
    console.warn(`Port ${PORT} is already in use. Retrying on port ${fallbackPort}.`);
    startServer(fallbackPort);
    return;
  }

  throw err;
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

startServer(PORT);
