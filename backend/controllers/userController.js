import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import BoxAudit from '../models/boxAuditModel.js';

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

// Admin or User: Change password for any user (Admin can change others, User can change self)
export const changeUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, confirmPassword } = req.body;
    const requestingUser = req.user;

    // Validate passwords provided
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation required' });
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    // Validate password length (minimum 8 characters recommended)
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Check authorization: only admin can change others, users can only change themselves
    if (requestingUser.role !== 'admin' && requestingUser._id.toString() !== id) {
      return res.status(403).json({ message: 'You can only change your own password' });
    }

    // Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Log audit event
    try {
      await BoxAudit.create({
        user: requestingUser._id,
        note: `Password changed for ${user.email} by ${requestingUser.email}`,
        action: 'password_change',
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
      // Continue even if audit logging fails
    }

    res.status(200).json({ 
      message: 'Password changed successfully',
      user: { _id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
