import express from "express";
import {
  bookTicket,
  getBookingById,
  getUserBookings
} from "../controller/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, bookTicket);
router.get("/my-bookings", protect, getUserBookings);
router.get("/:id", protect, getBookingById);

export default router;
