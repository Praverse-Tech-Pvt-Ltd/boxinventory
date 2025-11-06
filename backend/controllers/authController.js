import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Register
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = generateToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "None", // ✅ must be 'None' for cross-origin
      secure: true, // ✅ must be true for SameSite=None to work
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Login
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "None", // ✅ must be 'None' for cross-origin
      secure: true, // ✅ must be true for SameSite=None to work
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Logout
export const logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    sameSite: "Strict",
    secure: false, // set true in production
    expires: new Date(0), // expires immediately
  });
  res.status(200).json({ message: "Logged out successfully" });
};

export const getProfile = async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Not logged in" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    res.status(200).json(user);
  } catch (error) {
    res.status(401).json({ message: "Token invalid or expired" });
  }
};
