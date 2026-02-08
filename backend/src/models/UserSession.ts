import mongoose, { Schema, Document } from "mongoose";

export type SessionStatus = 'active' | 'logged_out' | 'expired' | 'revoked';

export interface IUserSession extends Document {
  userId: mongoose.Types.ObjectId;
  loginAt: Date;
  logoutAt?: Date;
  status: SessionStatus;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
  };
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSessionSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    loginAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    logoutAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'logged_out', 'expired', 'revoked'],
      default: 'active',
      index: true
    },
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    deviceInfo: {
      browser: { type: String },
      os: { type: String },
      device: { type: String }
    },
    lastActivityAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

// Índices compostos para queries comuns
UserSessionSchema.index({ userId: 1, status: 1 });
UserSessionSchema.index({ userId: 1, loginAt: -1 });
UserSessionSchema.index({ status: 1, expiresAt: 1 });

// Método estático para criar sessão
UserSessionSchema.statics.createSession = async function(
  userId: mongoose.Types.ObjectId | string,
  req?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
) {
  const sessionDuration = 7 * 24 * 60 * 60 * 1000; // 7 dias
  const expiresAt = new Date(Date.now() + sessionDuration);

  let ipAddress = req?.ip;
  let userAgent = req?.headers?.['user-agent'] as string | undefined;

  // Parse user agent for device info
  let deviceInfo: { browser?: string; os?: string; device?: string } = {};
  if (userAgent) {
    // Simple parsing - can be enhanced with a proper library
    if (userAgent.includes('Chrome')) deviceInfo.browser = 'Chrome';
    else if (userAgent.includes('Firefox')) deviceInfo.browser = 'Firefox';
    else if (userAgent.includes('Safari')) deviceInfo.browser = 'Safari';
    else if (userAgent.includes('Edge')) deviceInfo.browser = 'Edge';

    if (userAgent.includes('Windows')) deviceInfo.os = 'Windows';
    else if (userAgent.includes('Mac')) deviceInfo.os = 'macOS';
    else if (userAgent.includes('Linux')) deviceInfo.os = 'Linux';
    else if (userAgent.includes('Android')) deviceInfo.os = 'Android';
    else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) deviceInfo.os = 'iOS';

    if (userAgent.includes('Mobile')) deviceInfo.device = 'Mobile';
    else deviceInfo.device = 'Desktop';
  }

  return this.create({
    userId,
    loginAt: new Date(),
    status: 'active',
    ipAddress,
    userAgent,
    deviceInfo,
    lastActivityAt: new Date(),
    expiresAt
  });
};

// Método estático para encerrar sessão
UserSessionSchema.statics.endSession = async function(
  userId: mongoose.Types.ObjectId | string,
  status: 'logged_out' | 'expired' | 'revoked' = 'logged_out'
) {
  // Encerra a sessão ativa mais recente do usuário
  return this.findOneAndUpdate(
    { userId, status: 'active' },
    {
      $set: {
        status,
        logoutAt: new Date()
      }
    },
    { sort: { loginAt: -1 }, new: true }
  );
};

// Método estático para obter sessões ativas
UserSessionSchema.statics.getActiveSessions = async function(userId?: mongoose.Types.ObjectId | string) {
  const query: Record<string, unknown> = { status: 'active', expiresAt: { $gt: new Date() } };
  if (userId) {
    query.userId = userId;
  }
  return this.find(query).populate('userId', 'email name').sort({ loginAt: -1 });
};

// Método estático para expirar sessões antigas
UserSessionSchema.statics.expireOldSessions = async function() {
  return this.updateMany(
    {
      status: 'active',
      expiresAt: { $lt: new Date() }
    },
    {
      $set: {
        status: 'expired',
        logoutAt: new Date()
      }
    }
  );
};

// Interface para métodos estáticos
interface IUserSessionModel extends mongoose.Model<IUserSession> {
  createSession(userId: mongoose.Types.ObjectId | string, req?: { ip?: string; headers?: Record<string, string | string[] | undefined> }): Promise<IUserSession>;
  endSession(userId: mongoose.Types.ObjectId | string, status?: 'logged_out' | 'expired' | 'revoked'): Promise<IUserSession | null>;
  getActiveSessions(userId?: mongoose.Types.ObjectId | string): Promise<IUserSession[]>;
  expireOldSessions(): Promise<mongoose.UpdateWriteOpResult>;
}

export default mongoose.model<IUserSession, IUserSessionModel>("UserSession", UserSessionSchema);
