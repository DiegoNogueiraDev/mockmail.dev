import mongoose, { Schema, Document } from "mongoose";

// Tipos de roles disponíveis
export type UserRole = 'user' | 'admin' | 'system';

// Permissões disponíveis
export type Permission = 'read:emails' | 'write:emails' | 'admin:users' | 'admin:system';

// Mapeamento de roles para permissões padrão
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: ['read:emails', 'write:emails'],
  admin: ['read:emails', 'write:emails', 'admin:users'],
  system: ['read:emails', 'write:emails', 'admin:users', 'admin:system'],
};

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  notifications?: {
    emailOnReceive: boolean;
    emailOnBoxExpire: boolean;
    digestFrequency: 'instant' | 'hourly' | 'daily' | 'off';
  };
  hasPermission(permission: Permission): boolean;
  hasRole(...roles: UserRole[]): boolean;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Email inválido',
      },
    },
    password: { type: String, required: true, minlength: 12 },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['user', 'admin', 'system'],
      default: 'user'
    },
    permissions: [{
      type: String,
      enum: ['read:emails', 'write:emails', 'admin:users', 'admin:system']
    }],
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    notifications: {
      emailOnReceive: { type: Boolean, default: false },
      emailOnBoxExpire: { type: Boolean, default: false },
      digestFrequency: { type: String, enum: ['instant', 'hourly', 'daily', 'off'], default: 'off' },
    },
  },
  { timestamps: true }
);;;

// Método para verificar se usuário tem uma permissão específica
UserSchema.methods.hasPermission = function(permission: Permission): boolean {
  // Verificar permissões explícitas
  if (this.permissions && this.permissions.includes(permission)) {
    return true;
  }
  // Verificar permissões do role
  const rolePermissions = ROLE_PERMISSIONS[this.role as UserRole] || [];
  return rolePermissions.includes(permission);
};

// Método para verificar se usuário tem um dos roles especificados
UserSchema.methods.hasRole = function(...roles: UserRole[]): boolean {
  return roles.includes(this.role);
};

// Índices para performance
UserSchema.index({ role: 1 });

export default mongoose.model<IUser>("User", UserSchema);
