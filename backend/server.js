import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import boxRoutes from "./routes/boxRoutes.js";
import challanRoutes from "./routes/challanRoutes.js";
import clientBatchRoutes from "./routes/clientBatchRoutes.js";

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "https://boxinventory.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        // Allow no-origin (like health checks) and known origins
        callback(null, true);
      } else {
        console.warn("❌ CORS blocked for origin:", origin); // optional log
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/boxes", boxRoutes);
app.use("/api/challans", challanRoutes);
app.use("/api/client-batches", clientBatchRoutes);

app.get("/health", (req, res) => {
  console.log("🩺 Health check at:", new Date().toLocaleString());
  res.status(200).send("OK");
});

// root route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
