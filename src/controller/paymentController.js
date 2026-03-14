import Payment from "../models/Payment.js"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import { sendEmail } from "../utils/sendEmail.js"
import QRCode from "qrcode"
import { v4 as uuidv4 } from "uuid"
import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY missing in environment variables")
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const CHECKOUT_SESSION_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9]+$/

// ----------------------
// HELPERS
// ----------------------

const stripTrailingSlash = (url) => String(url || "").replace(/\/+$/, "")

const getOriginFromReferer = (referer) => {
  try {
    return referer ? new URL(referer).origin : ""
  } catch {
    return ""
  }
}

const getClientBaseUrl = (req) => {
  if (process.env.CLIENT_URL) return stripTrailingSlash(process.env.CLIENT_URL)
  if (process.env.FRONTEND_URL) return stripTrailingSlash(process.env.FRONTEND_URL)
  return req.headers.origin || "http://localhost:5173"
}

const resolveClientBaseUrl = (req) => {
  const requestedClientBaseUrl =
    req.body?.clientBaseUrl || req.headers.origin || getOriginFromReferer(req.headers.referer)

  if (requestedClientBaseUrl) {
    return stripTrailingSlash(requestedClientBaseUrl)
  }

  return stripTrailingSlash(getClientBaseUrl(req))
}

const getServerBaseUrl = (req) => {
  if (process.env.SERVER_URL) return stripTrailingSlash(process.env.SERVER_URL)
  if (process.env.BACKEND_URL) return stripTrailingSlash(process.env.BACKEND_URL)

  const forwardedProtocol = req.headers["x-forwarded-proto"]?.split(",")?.[0]?.trim()
  const forwardedHost = req.headers["x-forwarded-host"]?.split(",")?.[0]?.trim()
  const protocol = forwardedProtocol || req.protocol || "http"
  const host = forwardedHost || req.get("host")

  return `${protocol}://${host}`
}

const normalizeMoney = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return Number(num.toFixed(2))
}

// ----------------------
// CREATE STRIPE SESSION
// ----------------------

export const createStripeSession = async (req, res) => {
  try {
    const { bookingId, amount } = req.body

    if (!bookingId) {
      return res.status(400).json({ message: "Booking id required" })
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user,
    }).populate("event", "title")

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    const payableAmount = normalizeMoney(amount) || normalizeMoney(booking.totalPrice)

    if (!payableAmount) {
      return res.status(400).json({ message: "Invalid payment amount" })
    }

    const clientBaseUrl = resolveClientBaseUrl(req)
    const serverBaseUrl = stripTrailingSlash(getServerBaseUrl(req))
    const unitAmount = Math.round(payableAmount * 100)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      client_reference_id: booking._id.toString(),
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `${booking.event?.title || "Event"} Ticket`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: booking._id.toString(),
        clientBaseUrl,
      },
      success_url: `${serverBaseUrl}/api/payments/verify?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientBaseUrl}/events`,
    })

    res.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error("Stripe session creation failed:", error)
    res.status(500).json({ message: error.message })
  }
}

// ----------------------
// VERIFY STRIPE PAYMENT
// ----------------------

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

    const clientBaseUrl = stripTrailingSlash(
      session.metadata?.clientBaseUrl || getClientBaseUrl(req)
    )

    if (booking.paymentStatus === "Success") {
      return res.redirect(`${clientBaseUrl}/success?bookingId=${bookingId}`)
    }

    await Payment.create({
      user: booking.user,
      booking: booking._id,
      amount: booking.totalPrice,
      paymentMethod: "Card",
      paymentStatus: "Success",
      transactionId: session.payment_intent || session.id,
    })

    booking.paymentStatus = "Success"

    const tickets = []

    for (let i = 0; i < booking.quantity; i++) {
      const ticketId = uuidv4()

      const qrCode = await QRCode.toDataURL(
        JSON.stringify({
          ticketId,
          eventId: booking.event._id,
        })
      )

      tickets.push({ ticketId, qrCode })
    }

    booking.tickets = tickets
    await booking.save()

    const user = await User.findById(booking.user)

    if (user?.email) {
      const attachments = tickets.map((ticket, index) => ({
        filename: `ticket-${index + 1}.png`,
        path: ticket.qrCode,
      }))

      await sendEmail(
        user.email,
        "Event Ticket Confirmation",
        `
        <h2>Payment Successful</h2>
        <p>Your tickets are attached. Please show the QR code at entry.</p>
        `,
        attachments
      )
    }

    res.redirect(`${clientBaseUrl}/success?bookingId=${bookingId}`)
  } catch (error) {
    console.error("Stripe payment verification failed:", error)
    res.status(500).json({ message: error.message })
  }
}

// ----------------------
// USER PAYMENTS
// ----------------------

export const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      user: req.user,
    }).populate("booking")

    res.json(payments)
  } catch {
    res.status(500).json({ message: "Error fetching payments" })
  }
}

// ----------------------
// ADMIN PAYMENTS
// ----------------------

export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().populate("user").populate("booking")

    res.json(payments)
  } catch {
    res.status(500).json({ message: "Error fetching payments" })
  }
}

// ----------------------
// UPDATE PAYMENT
// ----------------------

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

// ----------------------
// REFUND PAYMENT
// ----------------------

export const refundPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" })
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment.transactionId,
    })

    payment.paymentStatus = "Refunded"
    await payment.save()

    res.json({
      message: "Refund successful",
      refund,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ----------------------
// DELETE PAYMENT
// ----------------------

export const deletePayment = async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id)

    res.json({ message: "Payment deleted" })
  } catch {
    res.status(500).json({ message: "Error deleting payment" })
  }
}
