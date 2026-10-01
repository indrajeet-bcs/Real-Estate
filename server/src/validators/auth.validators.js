import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name is required').optional(),
  phone: z.string().optional().or(z.literal('')),
  altMobile: z.string().optional().or(z.literal('')),
  designation: z.string().optional().or(z.literal('')),
  avatar: z.string().optional().or(z.literal('')),
  // Personal information (Profile §2).
  dob: z.coerce.date().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  bloodGroup: z.string().optional().or(z.literal('')),
  maritalStatus: z.enum(['single', 'married', 'other', '']).optional(),
  address: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactNumber: z.string().optional().or(z.literal('')),
  notificationPrefs: z.object({
    inApp: z.boolean().optional(),
    email: z.boolean().optional(),
  }).optional(),
  // Preferences (Profile §6).
  preferences: z.object({
    language: z.string().optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    dateFormat: z.string().optional(),
  }).optional(),
})
