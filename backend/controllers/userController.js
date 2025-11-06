import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// Update username and/or password
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, currentPassword, newPassword } = req.body;

    // Update name if provided
    if (name) user.name = name;

    // Change password only if both current and new passwords are provided
    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();
    res.status(200).json({ message: 'Profile updated successfully', user: { name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
