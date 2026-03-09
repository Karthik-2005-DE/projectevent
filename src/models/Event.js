import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    date: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    totalTickets: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    availableTickets: {
      type: Number,
      required: true,
      min: 0,
      default: function () {
        return this.totalTickets ?? 0;
      },
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);
