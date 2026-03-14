import Booking from "../models/Booking.js";
import Event from "../models/Event.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

/* =========================
   USERS
========================= */

// Get all users
export const getAllUsers = async (req, res) => {
  try {

    const users = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      users
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching users"
    });
  }
};


// Delete user
export const deleteUser = async (req, res) => {
  try {

    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


// Restore blocked user
export const restoreUser = async (req, res) => {
  try {

    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isDeleted: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "User restored successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error restoring user"
    });
  }
};


/* =========================
   EVENTS
========================= */

// Get all events
export const getAllEvents = async (req, res) => {
  try {

    const events = await Event.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      events
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch events"
    });
  }
};


// Update event
export const updateEvent = async (req, res) => {
  try {

    const { id } = req.params;

    const event = await Event.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    res.status(200).json({
      success: true,
      event
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update event"
    });
  }
};


// Delete event + refund users
export const deleteEvent = async (req, res) => {
  try {

    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Find bookings for the event
    const bookings = await Booking.find({ event: id });

    for (const booking of bookings) {

      // update booking status
      booking.paymentStatus = "Refunded";
      await booking.save();

      // find payment for booking
      const payment = await Payment.findOne({ booking: booking._id });

      if (payment) {
        payment.paymentStatus = "Refunded";
        await payment.save();
      }

    }

    // delete event
    await Event.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Event deleted and refunds processed"
    });

  } catch (error) {

    console.error("Delete Event Error:", error);   // IMPORTANT

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

/* =========================
   PAYMENTS
========================= */

// Get all payments
export const getAllPayments = async (req, res) => {
  try {

    const payments = await Payment.find()
      .populate("user", "name email")
      .populate("booking")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      payments
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments"
    });
  }
};


// Update payment
export const updatePayment = async (req, res) => {
  try {

    const { id } = req.params;

    const payment = await Payment.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    res.status(200).json({
      success: true,
      payment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update payment"
    });
  }
};


// Delete payment
export const deletePayment = async (req, res) => {
  try {

    const { id } = req.params;

    const payment = await Payment.findByIdAndDelete(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete payment"
    });
  }
};