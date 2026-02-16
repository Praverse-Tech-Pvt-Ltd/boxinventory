/*
  DEBUG: Test endpoint to verify auth and admin status
  This is a temporary endpoint to help diagnose permission issues
  Remove after debugging
*/

export const testAuth = async (req, res) => {
  try {
    const user = req.user;
    const isAuthenticated = !!user;
    const isAdmin = user?.role === 'admin';
    
    res.status(200).json({
      authenticated: isAuthenticated,
      isAdmin: isAdmin,
      user: user ? { _id: user._id, name: user.name, email: user.email, role: user.role } : null,
      message: isAuthenticated ? (isAdmin ? "User is authenticated and is admin" : "User is authenticated but is NOT admin") : "User is NOT authenticated"
    });
  } catch (error) {
    res.status(500).json({ message: "Error", error: error.message });
  }
};
