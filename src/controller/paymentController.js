import Payment from "../models/Payment.js"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import { sendEmail } from "../utils/sendEmail.js"
import QRCode from "qrcode"
import { v4 as uuidv4 } from "uuid"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const stripTrailingSlash = (url) => String(url || "").replace(/\/+$/, "")

const getClientBaseUrl = (req) => {
  if (process.env.CLIENT_URL) return stripTrailingSlash(process.env.CLIENT_URL)
  if (process.env.FRONTEND_URL) return stripTrailingSlash(process.env.FRONTEND_URL)
  return req.headers.origin || "http://localhost:5173"
}

const getApiBaseUrl = (req) => {
  if (process.env.API_BASE_URL) return stripTrailingSlash(process.env.API_BASE_URL)

  const protocol = req.headers["x-forwarded-proto"] || req.protocol
  return `${protocol}://${req.get("host")}/api`
}

const normalizeMoney = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return Number(num.toFixed(2))
}

const CHECKOUT_SESSION_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9]+$/

// CREATE STRIPE SESSION
export const createStripeSession = async (req, res) => {
  try {

    const { bookingId, amount } = req.body

    if (!bookingId) {
      return res.status(400).json({ message: "Booking id required" })
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user
    }).populate("event", "title")

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    const bookingTotal = normalizeMoney(booking.totalPrice)
    const requestedAmount = normalizeMoney(amount)

    if (!bookingTotal) {
      return res.status(400).json({ message: "Invalid booking amount" })
    }

    if (requestedAmount && Math.abs(requestedAmount - bookingTotal) > 0.01) {
      return res.status(400).json({ message: "Amount mismatch" })
    }

    const payableAmount = requestedAmount || bookingTotal
    const unitAmount = Math.round(payableAmount * 100)

    const clientBaseUrl = stripTrailingSlash(getClientBaseUrl(req))
    const apiBaseUrl = stripTrailingSlash(getApiBaseUrl(req))

    const session = await stripe.checkout.sessions.create({

      payment_method_types: ["card"],
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `${booking.event?.title || "Event"} Ticket`
            },
            unit_amount: unitAmount
          },
          quantity: 1
        }
      ],

      metadata: {
        bookingId: booking._id.toString()
      },

      client_reference_id: booking._id.toString(),

      success_url: `${apiBaseUrl}/payments/verify?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientBaseUrl}/events`
    })

    return res.json({
      sessionId: session.id,
      url: session.url
    })

  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}


// VERIFY STRIPE PAYMENT
export const verifyStripePayment = async (req, res) => {
  try {

    const { session_id } = req.query

    if (!session_id || !CHECKOUT_SESSION_PATTERN.test(session_id)) {
      return res.status(400).json({ message: "Invalid session id" })
    }

    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" })
    }

    const bookingId = session.metadata?.bookingId || session.client_reference_id

    const booking = await Booking.findById(bookingId).populate("event")

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    const clientBaseUrl = stripTrailingSlash(getClientBaseUrl(req))

    // Prevent duplicate processing
    if (booking.paymentStatus === "Success") {
      return res.redirect(`${clientBaseUrl}/success?bookingId=${bookingId}`)
    }

    // Save payment
    await Payment.create({
      user: booking.user,
      booking: booking._id,
      amount: booking.totalPrice,
      paymentMethod: "Card",
      paymentStatus: "Success",
      transactionId: session.payment_intent || session.id
    })

    booking.paymentStatus = "Success"

    // Generate QR tickets
    const tickets = []

    for (let i = 0; i < booking.quantity; i++) {

      const ticketId = uuidv4()

      const qrCode = await QRCode.toDataURL(JSON.stringify({
        ticketId,
        eventId: booking.event._id
      }))

      tickets.push({
        ticketId,
        qrCode
      })
    }

    booking.tickets = tickets

    await booking.save()

    // Send ticket email
    const user = await User.findById(booking.user)

    if (user?.email) {

      const attachments = tickets.map((ticket, index) => ({
        filename: `ticket-${index + 1}.png`,
        path: ticket.qrCode
      }))

      await sendEmail(
        user.email,
        "Event Ticket Confirmation",
        `<h2>Payment Successful</h2>
         <p>Your tickets are attached. Please show the QR code at entry.</p>`,
        attachments
      )
    }

    return res.redirect(`${clientBaseUrl}/success?bookingId=${bookingId}`)

  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}


// GET USER PAYMENTS
export const getMyPayments = async (req, res) => {
  try {

    const payments = await Payment.find({
      user: req.user
    }).populate("booking")

    res.json(payments)

  } catch {
    res.status(500).json({ message: "Error fetching payments" })
  }
}


// ADMIN GET ALL PAYMENTS
export const getAllPayments = async (req, res) => {
  try {

    const payments = await Payment.find()
      .populate("user")
      .populate("booking")

    res.json(payments)

  } catch {
    res.status(500).json({ message: "Error fetching payments" })
  }
}


// ADMIN UPDATE PAYMENT
export const updatePaymentStatus = async (req, res) => {
  try {

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: req.body.paymentStatus },
      { new: true }
    )

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" })
    }

    res.json(payment)

  } catch {
    res.status(500).json({ message: "Error updating payment" })
  }
}


// ADMIN REFUND PAYMENT
export const refundPayment = async (req, res) => {
  try {

    const payment = await Payment.findById(req.params.id)

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" })
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment.transactionId
    })

    payment.paymentStatus = "Refunded"

    await payment.save()

    res.json({
      message: "Refund successful",
      refund
    })

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}


// DELETE PAYMENT
export const deletePayment = async (req, res) => {
  try {

    await Payment.findByIdAndDelete(req.params.id)

    res.json({ message: "Payment deleted" })

  } catch {
    res.status(500).json({ message: "Error deleting payment" })
  }
}