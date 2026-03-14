import express from "express";
import {
  createStripeSession,
  verifyStripePayment,
  getMyPayments,
  getAllPayments,
  updatePaymentStatus,
  deletePayment,
  refundPayment
} from "../controller/paymentController.js";

import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

// â­ STRIPE
router.post("/stripe-session", protect, createStripeSession);
router.get("/verify", verifyStripePayment);

// â­ USER
router.get("/my-payments", protect, getMyPayments);

// â­ ADMIN
router.get("/", protect, adminOnly, getAllPayments);
router.put("/:id", protect, adminOnly, updatePaymentStatus);
router.post("/refund/:id", protect, adminOnly, refundPayment)
router.delete("/:id", protect, adminOnly, deletePayment);

export default router;
