import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
{
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true
  },

  amount: {
    type: Number,
    required: true,
    min: 0
  },

  paymentMethod: {
    type: String,
    enum: ["Card", "UPI", "NetBanking"],
    required: true
  },

  paymentStatus: {
    type: String,
    enum: ["Pending", "Success", "Failed", "Refunded"],
    default: "Pending"
  },

  transactionId: {
    type: String
  }

},
{ timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);