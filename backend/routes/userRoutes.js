import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { updateUserProfile, changeUserPassword } from '../controllers/userController.js';
import { adminOnly } from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.get('/profile', protect, (req, res) => {
  res.status(200).json(req.user);
});

router.put('/update-profile', protect, updateUserProfile);

// Change password for any user (Admin can change others, User can change self)
router.put('/:id/password', protect, changeUserPassword);

export default router;
