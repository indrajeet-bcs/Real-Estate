import { Router } from 'express'
import {
  getCategories, createCategory, updateCategory, toggleCategory, deleteCategory,
  listMembers, createMember, updateMember, deactivateMember, toggleMemberStatus,
  listTickets, getTicket, createTicket, updateTicket, changeTicketStatus, assignTicket, addInternalNote
} from '../controllers/ticket.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'

const router = Router()

router.use(authenticate)

const superAdminOnly = requireRole(ROLES.SUPER_ADMIN)

// Categories — readable by any authenticated user (needed to file/classify a
// ticket); managed by Super Admin only.
router.get('/categories', getCategories)
router.post('/categories', superAdminOnly, createCategory)
router.patch('/categories/:id', superAdminOnly, updateCategory)
router.patch('/categories/:id/status', superAdminOnly, toggleCategory)
router.delete('/categories/:id', superAdminOnly, deleteCategory)

// Support Members — readable by any authenticated user (for assignment display);
// managed by Super Admin only.
router.get('/members', listMembers)
router.post('/members', superAdminOnly, createMember)
router.patch('/members/:id', superAdminOnly, updateMember)
router.patch('/members/:id/status', superAdminOnly, toggleMemberStatus)
router.delete('/members/:id', superAdminOnly, deactivateMember)

// Tickets — all roles; each is firm-scoped in the controller (Super Admin sees all).
router.get('/', listTickets)
router.post('/', createTicket)
router.get('/:id', getTicket)
router.patch('/:id', updateTicket)
router.patch('/:id/status', changeTicketStatus)
router.patch('/:id/assign', assignTicket)
router.post('/:id/notes', addInternalNote)

export default router
