import { v4 as uuidv4 } from 'uuid';

class Notification {
  constructor(userId, type, message) {
    this.id = uuidv4();
    this.userId = userId;
    this.type = type;
    this.message = message;
    this.timestamp = new Date();
  }
}

export default Notification;
