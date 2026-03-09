import Booking from "../models/Booking.js";
import Event from "../models/Event.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

export const getAdminStats = async (req, res) => {
  try {
    const [events, bookings, payments, users] = await Promise.all([
      Event.countDocuments(),
      Booking.countDocuments(),
      Payment.countDocuments(),
      User.countDocuments(),
    ]);

    res.json({
      stats: {
        events,
        bookings,
        payments,
        users,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error loading admin dashboard stats" });
  }
};
