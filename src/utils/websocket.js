import { Server } from 'socket.io';

let io;
const userSockets = new Map();

function initSocket(server) {
  io = new Server(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    const { userId } = socket.handshake.query;
    if (userId) userSockets.set(userId, socket);

    socket.on('disconnect', () => {
      userSockets.delete(userId);
    });
  });
}

function emitToUser(userId, message) {
  const socket = userSockets.get(userId);
  if (socket) socket.emit('notification', message);
}

export { initSocket, emitToUser };
export default { initSocket, emitToUser };
