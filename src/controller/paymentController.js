import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import Stripe from "stripe";

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);
const stripTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const getApiBaseUrl = (req) => {
  if (process.env.API_BASE_URL) {
    return stripTrailingSlash(process.env.API_BASE_URL);
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string" && forwardedProto.length > 0
      ? forwardedProto.split(",")[0]
      : req.protocol;

  return `${protocol}://${req.get("host")}/api`;
};

const getClientBaseUrl = (req) => {
  if (process.env.CLIENT_URL) {
    return stripTrailingSlash(process.env.CLIENT_URL);
  }

  const requestOrigin = req?.headers?.origin;

  if (requestOrigin) {
    return stripTrailingSlash(requestOrigin);
  }

  return "http://localhost:5173";
};

// CREATE STRIPE SESSION
export const createStripeSession = async (req, res) => {
  try {
    const stripe = getStripe();
    const { bookingId, amount } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({ message: "bookingId and amount required" });
    }

    const apiBaseUrl = stripTrailingSlash(getApiBaseUrl(req));
    const clientBaseUrl = stripTrailingSlash(getClientBaseUrl(req));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: { name: "Event Ticket" },
            unit_amount: Number(amount) * 100
          },
          quantity: 1
        }
      ],
      metadata: { bookingId },
      success_url: `${apiBaseUrl}/payments/verify?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientBaseUrl}/payment-cancel`
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// VERIFY STRIPE PAYMENT
export const verifyStripePayment = async (req, res) => {
  try {
    const stripe = getStripe();
    const { session_id } = req.query;

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const bookingId = session.metadata.bookingId;
    const booking = await Booking.findById(bookingId).populate("event");

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const clientBaseUrl = stripTrailingSlash(getClientBaseUrl(req));

    if (booking.paymentStatus === "Paid") {
      return res.redirect(`${clientBaseUrl}/success?bookingId=${bookingId}`);
    }

    await Payment.create({
      user: booking.user,
      booking: bookingId,
      amount: booking.totalPrice,
      paymentMethod: "Card",
      paymentStatus: "Success",
      transactionId: session.payment_intent
    });

    booking.paymentStatus = "Paid";

    const tickets = [];
    for (let i = 0; i < booking.quantity; i++) {
      const ticketId = uuidv4();
      const qrImage = await QRCode.toDataURL(
        JSON.stringify({ ticketId, eventId: booking.event._id })
      );
      tickets.push({ ticketId, qrCode: qrImage });
    }

    booking.tickets = tickets;
    await booking.save();

    const user = await User.findById(booking.user);

    const attachments = booking.tickets.map((ticket, index) => ({
      filename: `ticket-${index + 1}.png`,
      path: ticket.qrCode
    }));

    await sendEmail(
      user.email,
      "Event Ticket Confirmation",
      `<h2>Payment successful</h2>
       <p>Your tickets are attached. Show QR at entry.</p>`,
      attachments
    );

    return res.redirect(`${clientBaseUrl}/success?bookingId=${bookingId}`);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET MY PAYMENTS
export const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user }).populate("booking");
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching payments" });
  }
};

// ADMIN GET ALL PAYMENTS
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("user")
      .populate("booking");

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching payments" });
  }
};

// UPDATE PAYMENT STATUS
export const updatePaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: req.body.paymentStatus },
      { new: true }
    );

    if (!payment) return res.status(404).json({ message: "Payment not found" });

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: "Error updating payment" });
  }
};

// DELETE PAYMENT
export const deletePayment = async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ message: "Payment deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting payment" });
  }
};
