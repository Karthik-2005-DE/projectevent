import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import Stripe from "stripe";

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);
const stripTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");
const CHECKOUT_SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9]+$/;

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

  if (process.env.FRONTEND_URL) {
    return stripTrailingSlash(process.env.FRONTEND_URL);
  }

  const requestOrigin = req?.headers?.origin;

  if (requestOrigin) {
    return stripTrailingSlash(requestOrigin);
  }

  return "http://localhost:5173";
};

const normalizeMoney = (value) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Number(parsed.toFixed(2));
};

const sanitizeStripeCheckoutUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const parsedUrl = new URL(value.trim());

    if (parsedUrl.hostname !== "checkout.stripe.com") {
      return "";
    }

    return parsedUrl.toString();
  } catch {
    return "";
  }
};

// CREATE STRIPE SESSION
export const createStripeSession = async (req, res) => {
  try {
    const stripe = getStripe();
    const { bookingId, amount } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: "bookingId required" });
    }

    const booking = await Booking.findOne({ _id: bookingId, user: req.user }).populate(
      "event",
      "title"
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const bookingTotal = normalizeMoney(booking.totalPrice);

    if (!bookingTotal) {
      return res.status(400).json({ message: "Invalid booking amount" });
    }

    const requestedAmount = normalizeMoney(amount);

    if (requestedAmount && Math.abs(requestedAmount - bookingTotal) > 0.01) {
      return res.status(400).json({
        message: "Amount mismatch for booking",
      });
    }

    const payableAmount = requestedAmount || bookingTotal;
    const unitAmount = Math.round(payableAmount * 100);

    const apiBaseUrl = stripTrailingSlash(getApiBaseUrl(req));
    const clientBaseUrl = stripTrailingSlash(getClientBaseUrl(req));
    const cancelPath = booking?.event?._id ? `/payment/${booking.event._id}` : "/events";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: booking?.event?.title ? `${booking.event.title} Ticket` : "Event Ticket",
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: String(booking._id),
        userId: String(req.user),
      },
      client_reference_id: String(booking._id),
      success_url: `${apiBaseUrl}/payments/verify?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientBaseUrl}${cancelPath}`,
    });

    const safeCheckoutUrl = sanitizeStripeCheckoutUrl(session?.url);

    if (!safeCheckoutUrl) {
      return res.status(500).json({
        message: "Stripe checkout URL missing or invalid",
      });
    }

    return res.json({
      sessionId: session.id,
      id: session.id,
      url: safeCheckoutUrl,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// VERIFY STRIPE PAYMENT
export const verifyStripePayment = async (req, res) => {
  try {
    const stripe = getStripe();
    const { session_id } = req.query;

    if (!session_id || !CHECKOUT_SESSION_ID_PATTERN.test(session_id)) {
      return res.status(400).json({ message: "Invalid session id" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const bookingId = session.metadata?.bookingId || session.client_reference_id;

    if (!bookingId) {
      return res.status(400).json({ message: "Booking id missing" });
    }

    const booking = await Booking.findById(bookingId).populate("event");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const clientBaseUrl = stripTrailingSlash(getClientBaseUrl(req));

    // Prevent duplicate processing
    if (booking.paymentStatus === "Success") {
      return res.redirect(`${clientBaseUrl}/success?bookingId=${bookingId}`);
    }

    // Create payment record
    await Payment.create({
      user: booking.user,
      booking: bookingId,
      amount: booking.totalPrice,
      paymentMethod: "Card",
      paymentStatus: "Success",
      transactionId: session.payment_intent || session.id
    });

    // Update booking status
    booking.paymentStatus = "Success";

    // Generate tickets
    const tickets = [];
    for (let i = 0; i < booking.quantity; i++) {
      const ticketId = uuidv4();

      const qrImage = await QRCode.toDataURL(
        JSON.stringify({
          ticketId,
          eventId: booking.event._id
        })
      );

      tickets.push({
        ticketId,
        qrCode: qrImage
      });
    }

    booking.tickets = tickets;

    await booking.save();

    // Send email
    const user = await User.findById(booking.user);

    if (user?.email) {
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
    }

    return res.redirect(`${clientBaseUrl}/success?bookingId=${bookingId}`);

  } catch (error) {
    return res.status(500).json({ message: error.message });
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
    const payments = await Payment.find().populate("user").populate("booking");

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

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    return res.json(payment);
  } catch (error) {
    return res.status(500).json({ message: "Error updating payment" });
  }
};

// DELETE PAYMENT
export const deletePayment = async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    return res.json({ message: "Payment deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting payment" });
  }
};

