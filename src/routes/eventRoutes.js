import express from "express";
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} from "../controller/eventController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { upload } from "../controller/upload.js";

const router = express.Router();
const adminEventAccess = [protect, adminOnly, upload.single("image")];

router.get("/", getEvents);
router.get("/:id", getEventById);

router.post("/", ...adminEventAccess, createEvent);
router.put("/:id", ...adminEventAccess, updateEvent);
router.patch("/:id", ...adminEventAccess, updateEvent);
router.delete("/:id", protect, adminOnly, deleteEvent);

export default router;
