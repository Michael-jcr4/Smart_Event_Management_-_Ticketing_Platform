const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const SALT_ROUNDS = 10;
const ROLES = ["user", "organiser", "admin"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name must be at most 80 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address"],
    },
    // Never selected by default, so password hashes don't leak into views or logs.
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      default: "user",
    },
  },
  { timestamps: true }
);

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

// Only the fields that are safe to keep in the session.
userSchema.methods.toSessionUser = function toSessionUser() {
  return { _id: this._id.toString(), name: this.name, email: this.email, role: this.role };
};

module.exports = mongoose.model("User", userSchema);
module.exports.ROLES = ROLES;
