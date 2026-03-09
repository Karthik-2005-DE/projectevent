import Booking from "../models/Booking.js";
import Event from "../models/Event.js";

// BOOK TICKETS
export const bookTicket = async (req, res) => {
  try {
    const { eventId, quantity } = req.body;

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.availableTickets < quantity) {
      return res.status(400).json({ message: "Not enough tickets available" });
    }

    event.availableTickets -= quantity;
    await event.save();

    const totalPrice = event.price * quantity;

    const booking = await Booking.create({
      user: req.user,
      event: eventId,
      quantity,
      totalPrice
    });

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: "Booking failed", error: error.message });
  }
};

// GET USER BOOKINGS
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user }).populate("event");

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching bookings" });
  }
};

// GET SINGLE USER BOOKING
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user
    }).populate("event");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: "Error fetching booking" });
  }
};
