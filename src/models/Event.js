const mongoose = require("mongoose");

const CATEGORIES = ["Conference", "Workshop", "Festival", "Private"];

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [120, "Title must be at most 120 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [2000, "Description must be at most 2000 characters"],
    },
    category: {
      type: String,
      enum: { values: CATEGORIES, message: "Please choose a valid category" },
      required: [true, "Category is required"],
    },
    // Separate start and end dates so multi-day events are supported.
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator(value) {
          // `this` is the document on save; skip the check in query validators.
          return !(this instanceof mongoose.Document) || !this.startDate || value >= this.startDate;
        },
        message: "End date cannot be before start date",
      },
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      maxlength: [160, "Location must be at most 160 characters"],
    },
    totalCapacity: {
      type: Number,
      required: [true, "Total capacity is required"],
      min: [1, "Capacity must be at least 1"],
      validate: { validator: Number.isInteger, message: "Capacity must be a whole number" },
    },
    bookedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

eventSchema.index({ startDate: 1 });
eventSchema.index({ category: 1, startDate: 1 });

eventSchema.virtual("availableTickets").get(function availableTickets() {
  return Math.max(this.totalCapacity - this.bookedCount, 0);
});

module.exports = mongoose.model("Event", eventSchema);
module.exports.CATEGORIES = CATEGORIES;
