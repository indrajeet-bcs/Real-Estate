import { z } from 'zod'
import { optionalIndianMobileSchema } from '../utils/phoneValidation.js'

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
})

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  otp: z.string().trim().length(6, 'OTP must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export const acceptInvitationSchema = z.object({
  token: z.string().min(10, 'Invitation token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name is required').optional(),
  phone: optionalIndianMobileSchema,
  altMobile: optionalIndianMobileSchema,
  designation: z.string().optional().or(z.literal('')),
  avatar: z.string().optional().or(z.literal('')),
  // Personal information (Profile §2).
  dob: z.coerce.date().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  bloodGroup: z.string().optional().or(z.literal('')),
  maritalStatus: z.enum(['single', 'married', 'other', '']).optional(),
  address: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactNumber: optionalIndianMobileSchema,
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
