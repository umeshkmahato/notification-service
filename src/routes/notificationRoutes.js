import express from 'express';
const router = express.Router();

import { sendNotification, getUserNotifications } from '../controllers/notificationController.js';

router.post('/notifications', sendNotification);
router.get('/users/:id/notifications', getUserNotifications);

export default router;
