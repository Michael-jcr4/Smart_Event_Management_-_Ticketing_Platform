const mongoose = require("mongoose");

const STATUSES = ["confirmed", "cancelled"];

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "Quantity must be a whole number" },
    },
    // Price is copied at booking time so later price changes don't rewrite history.
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: STATUSES,
      default: "confirmed",
    },
    cancelledAt: Date,
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ event: 1, status: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
module.exports.STATUSES = STATUSES;
