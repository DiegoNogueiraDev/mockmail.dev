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
  hasPermission(permission: Permission): boolean;
  hasRole(...roles: UserRole[]): boolean;
}

const UserSchema: Schema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
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
    lastLogin: { type: Date }
  },
  { timestamps: true }
);

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
