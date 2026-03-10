import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();
connectDB();

const app = express();

/* Uploads folder */
const uploadsDirectory = path.resolve(process.cwd(), "uploads");

/* Allowed origins */
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

/* CORS configuration */
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin || 
        allowedOrigins.includes(origin) || 
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* Middlewares */
app.use(express.json());
app.use(cookieParser());

/* Static files */
app.use("/uploads", express.static(uploadsDirectory));

/* Routes */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);

/* Port */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});