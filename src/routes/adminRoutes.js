import express from "express"

import {
  getAdminStats,
  getAllUsers,
  toggleUserBlock,
  deleteUser,
  restoreUser,
  getAllEvents,
  deleteEvent,
  getAllPayments,
  updatePayment,
  deletePayment
} from "../controller/adminController.js"
import {
  createEvent as createAdminEvent,
  updateEvent as updateAdminEvent,
} from "../controller/eventController.js"
import { upload } from "../controller/upload.js"

import { protect } from "../middleware/authMiddleware.js"
import { adminOnly } from "../middleware/adminMiddleware.js"

const router = express.Router()

router.get("/stats", protect, adminOnly, getAdminStats)

router.get("/users", protect, adminOnly, getAllUsers)
router.put("/block-user/:id", protect, adminOnly, toggleUserBlock)
router.put("/delete-user/:id", protect, adminOnly, deleteUser)

router.put("/restore-user/:id", protect, adminOnly, restoreUser)

router.post("/events", protect, adminOnly, upload.single("image"), createAdminEvent)
router.get("/events", protect, adminOnly, getAllEvents)
router.put("/events/:id", protect, adminOnly, upload.single("image"), updateAdminEvent)
router.patch("/events/:id", protect, adminOnly, upload.single("image"), updateAdminEvent)
router.delete("/events/:id", protect, adminOnly, deleteEvent)

router.get("/payments", protect, adminOnly, getAllPayments)
router.put("/payments/:id", protect, adminOnly, updatePayment)
router.delete("/payments/:id", protect, adminOnly, deletePayment)

export default router
