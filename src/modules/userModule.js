import mongoose from "mongoose";

// Base user schema with common fields
const baseUserSchema = {
  firebaseUID: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    required: true,
    enum: ["customer", "driver"],
  }
};

// Customer schema - for customers/users
const customerSchema = new mongoose.Schema({
  ...baseUserSchema,
  customer_id: {
    type: String,
    unique: true,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  current_location: {
    address: {
      type: String,
      required: true
    },
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    }
  },
  // Customer-specific fields
  order_history: [{
    order_id: String,
    date: Date,
    status: String
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Driver schema - for drivers
const driverSchema = new mongoose.Schema({
  ...baseUserSchema,
  driver_id: {
    type: String,
    unique: true,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  current_location: {
    address: {
      type: String,
      required: true
    },
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    }
  },
  status: {
    type: String,
    enum: ["available", "busy", "offline"],
    default: "available"
  },
  assigned_orders: [{
    type: String
  }],
  completed_orders: [{
    type: String
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create models with explicit collection names
const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema, "customers");
const Driver = mongoose.models.Driver || mongoose.model("Driver", driverSchema, "drivers");

export { Customer, Driver };
