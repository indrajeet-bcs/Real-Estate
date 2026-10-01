import LeaveRequest from '../models/LeaveRequest.js'
import Booking from '../models/Booking.js'
import Unit from '../models/Unit.js'
import Customer from '../models/Customer.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/apiResponse.js'
import { BOOKING_STATUS, UNIT_STATUS, CUSTOMER_STATUS } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

const OPEN = [CUSTOMER_STATUS.NEW, CUSTOMER_STATUS.IN_PROGRESS, CUSTOMER_STATUS.FOLLOW_UP_DUE]

// GET /api/action-center/summary — pending-approval counts for the branch
// (drives the sidebar badge + the Action Center hub).
export const getActionSummary = asyncHandler(async (req, res) => {
  const scope = firmScope(req.user)
  const [pendingLeaves, reservedBookings, heldUnits, unassignedLeads] = await Promise.all([
    LeaveRequest.countDocuments({ ...scope, status: 'pending' }),
    Booking.countDocuments({ ...scope, status: BOOKING_STATUS.RESERVED }),
    Unit.countDocuments({ ...scope, status: UNIT_STATUS.LOCKED }),
    Customer.countDocuments({ ...scope, assignedTo: null, status: { $in: OPEN } }),
  ])
  const total = pendingLeaves + reservedBookings + heldUnits + unassignedLeads
  return ok(res, { pendingLeaves, reservedBookings, heldUnits, unassignedLeads, total }, 'Action center summary')
})
