import { z } from 'zod'
import { objectId } from '../utils/validators.common.js'

// Builders
export const createBuilderSchema = z.object({
  name: z.string().min(2, 'Builder name is required'),
  logo: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  gstNumber: z.string().optional(),
  reraCert: z.string().optional(),
  reraExpiry: z.coerce.date().optional(),
  commissionAgreement: z.string().optional(),
  complianceStatus: z.enum(['compliant', 'pending_review', 'non_compliant']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})
export const updateBuilderSchema = createBuilderSchema.partial()

// Projects
export const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name is required'),
  builder: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid builder is required'),
  location: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  propertyType: z.string().optional(),
  image: z.string().optional(),
  launchDate: z.coerce.date().optional(),
  possessionDate: z.coerce.date().optional(),
  amenities: z.array(z.string()).optional(),
  reraNumber: z.string().optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  constructionStatus: z.enum(['pre_launch', 'under_construction', 'ready_to_move']).optional(),
})
export const updateProjectSchema = createProjectSchema.partial()

// Unit lock (Admin-flow port): hold a unit for a lead with a reason.
export const lockUnitSchema = z.object({
  customer: objectId,
  reason: z.string().min(3, 'A lock reason is required'),
  hours: z.coerce.number().int().min(1).max(720).optional(),
})

// Units / inventory
const unitFields = {
  unitType: z.string().optional(),
  configuration: z.string().optional(),
  propertyType: z.string().optional(),
  floor: z.string().optional(),
  tower: z.string().optional(),
  facing: z.string().optional(),
  parking: z.string().optional(),
  twoWheelerParking: z.string().optional(),
  fourWheelerParking: z.string().optional(),
  areaSqft: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
  basePrice: z.coerce.number().optional(),
  currentPrice: z.coerce.number().optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
}
export const createUnitSchema = z.object({
  project: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid project is required'),
  unitNumber: z.string().min(1, 'Unit number is required'),
  ...unitFields,
})
export const updateUnitSchema = z.object({
  ...unitFields,
  project: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(), // reassign to another project
  unitNumber: z.string().min(1).optional(),
  status: z.enum(['available', 'reserved', 'booked', 'blocked', 'locked', 'token', 'hold', 'sold', 'registered', 'possession']).optional(),
})
