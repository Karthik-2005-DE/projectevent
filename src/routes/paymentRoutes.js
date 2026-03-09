import express from "express";
import {
  createStripeSession,
  verifyStripePayment,
  getMyPayments,
  getAllPayments,
  updatePaymentStatus,
  deletePayment
} from "../controller/paymentController.js";

import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

// ⭐ STRIPE
router.post("/stripe-session", protect, createStripeSession);
router.get("/verify", verifyStripePayment);

// ⭐ USER
router.get("/my-payments", protect, getMyPayments);

// ⭐ ADMIN
router.get("/", protect, adminOnly, getAllPayments);
router.put("/:id", protect, updatePaymentStatus);
router.delete("/:id", protect, deletePayment);

export default router;