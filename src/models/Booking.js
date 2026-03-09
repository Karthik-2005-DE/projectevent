import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    },
    paymentStatus: {
      type: String,
      default: "Pending"
    },
    tickets: [
  {
    ticketId: String,
    qrCode: String,
    isUsed: { type: Boolean, default: false }
  }
],
bookingId: String

  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
