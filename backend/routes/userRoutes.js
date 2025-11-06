import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { updateUserProfile } from '../controllers/userController.js';

const router = express.Router();

router.get('/profile', protect, (req, res) => {
  res.status(200).json(req.user);
});

router.put('/update-profile', protect, updateUserProfile);

export default router;
