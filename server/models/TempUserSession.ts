import mongoose, { Schema, Document } from 'mongoose';

export interface ITempUserSession extends Document {
  sessionId: string;
  restaurantId?: string; // Optional for restaurant-based sessions
  tableNumber?: string; // Optional for restaurant-based sessions
  restaurantName?: string; // Optional for restaurant-based sessions
  organizationId?: string; // Optional for organization-based sessions
  organizationName?: string; // Optional for organization-based sessions
  address?: string; // Address from QR code for organization sessions
  tempUserId: string;
  tempUserName: string;
  tempUserEmail: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  lastActivity: Date;
}

const TempUserSessionSchema = new Schema<ITempUserSession>({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  restaurantId: {
    type: String,
    required: false
  },
  tableNumber: {
    type: String,
    required: false
  },
  restaurantName: {
    type: String,
    required: false
  },
  organizationId: {
    type: String,
    required: false
  },
  organizationName: {
    type: String,
    required: false
  },
  address: {
    type: String,
    required: false
  },
  tempUserId: {
    type: String,
    required: true,
    unique: true
  },
  tempUserName: {
    type: String,
    required: true
  },
  tempUserEmail: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Create TTL index for automatic cleanup
TempUserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TempUserSessionModel = mongoose.model<ITempUserSession>('TempUserSession', TempUserSessionSchema);

