// Health check endpoint - no auth required
// This helps diagnose if the server is running

export const healthCheck = async (req, res) => {
  try {
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      message: "Backend is running and responding"
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: error.message
    });
  }
};
