import express from "express"
import {getAllUsers,
    deleteUser,
    restoreUser,
    getAllEvents,
    updateEvent,
    deleteEvent,
    getAllPayments,
    updatePayment,
    deletePayment
} from "../controller/adminController.js"
import { adminOnly } from "../middleware/adminMiddleware.js"

const router = express.Router()

router.get("/users",adminOnly,getAllUsers)
router.put("/delete-user/:id",adminOnly,deleteUser)
router.put("/restore-user/:id",adminOnly,restoreUser)
router.get("/events", adminOnly, getAllEvents);
router.put("/events/:id", adminOnly, updateEvent);
router.delete("/events/:id", adminOnly, deleteEvent);

router.get("/payments", adminOnly, getAllPayments);
router.put("/payments/:id", adminOnly, updatePayment);
router.delete("/payments/:id", adminOnly, deletePayment);

export default router