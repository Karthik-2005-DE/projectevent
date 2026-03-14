import express from "express"

import {
  getAllUsers,
  deleteUser,
  restoreUser,
  getAllEvents,
  updateEvent,
  deleteEvent,
  getAllPayments,
  updatePayment,
  deletePayment
} from "../controller/adminController.js"

import { protect, adminOnly } from "../middleware/adminMiddleware.js"

const router = express.Router()

router.get("/users", protect, adminOnly, getAllUsers)

router.put("/delete-user/:id", protect, adminOnly, deleteUser)

router.put("/restore-user/:id", protect, adminOnly, restoreUser)

router.get("/events", protect, adminOnly, getAllEvents)
router.put("/events/:id", protect, adminOnly, updateEvent)
router.delete("/events/:id", protect, adminOnly, deleteEvent)

router.get("/payments", protect, adminOnly, getAllPayments)
router.put("/payments/:id", protect, adminOnly, updatePayment)
router.delete("/payments/:id", protect, adminOnly, deletePayment)

export default router