import { useState, useEffect } from 'react'
import { Modal, Button, Input, Select, Textarea } from '../ui.jsx'
import { ROLE_CATEGORIES, ROLE_STATUSES } from '../../lib/roleConstants.js'
import { rolesApi } from '../../api/resources.js'
import { useToast } from '../../context/ToastContext.jsx'

// Enforcement tiers (the hard requireRole level a custom role maps to).
const BASE_ROLES = [
  { value: 'admin', label: 'Company Owner (Admin)' },
  { value: 'sub_admin', label: 'Manager / Department (Sub-Admin)' },
  { value: 'sales_executive', label: 'Executive / Field (Sales Executive)' },
]
// Sensible default enforcement tier per category.
const baseRoleForCategory = (c) => (c === 'Company' ? 'admin' : c === 'Operational' ? 'sales_executive' : 'sub_admin')

export default function CreateEditRoleDrawer({ open, onClose, roleToEdit, existingRoles, onSaved }) {
  const toast = useToast()
  const isEditing = !!roleToEdit
  const isSystem = isEditing && roleToEdit.type === 'System Role'

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    baseRole: 'sales_executive',
    status: 'Active',
    reportsTo: ''
  })

  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      if (roleToEdit) {
        setForm({
          name: roleToEdit.name,
          description: roleToEdit.description,
          category: roleToEdit.category,
          baseRole: roleToEdit.baseRole || baseRoleForCategory(roleToEdit.category),
          status: roleToEdit.status,
          reportsTo: roleToEdit.reportsTo || ''
        })
      } else {
        setForm({
          name: '',
          description: '',
          category: '',
          baseRole: 'sales_executive',
          status: 'Active',
          reportsTo: ''
        })
      }
      setErrors({})
    }
  }, [open, roleToEdit])

  const validate = () => {
    const newErrors = {}
    if (!form.name.trim()) {
      newErrors.name = 'Role Name is required'
    } else {
      // Check for protected names
      const lowerName = form.name.toLowerCase().trim()
      const protectedNames = ['saas super admin', 'platform owner', 'company owner', 'platform admin']
      
      if (protectedNames.includes(lowerName) && !isSystem) {
        newErrors.name = 'This is a protected system role name'
      } else {
        // Check for duplicates (case-insensitive) ignoring the current role
        const isDuplicate = existingRoles.some(r => 
          r.name.toLowerCase().trim() === lowerName && 
          (!isEditing || r.id !== roleToEdit.id)
        )
        if (isDuplicate) newErrors.name = 'Role name already exists'
      }
    }

    if (!form.category) {
      newErrors.category = 'Category is required'
    }

    if (isEditing && form.reportsTo === roleToEdit.id) {
      newErrors.reportsTo = 'A role cannot report to itself'
    } else if (form.reportsTo) {
      // Check for circular dependency
      let currentParentId = form.reportsTo
      while (currentParentId) {
        if (isEditing && currentParentId === roleToEdit.id) {
          newErrors.reportsTo = 'Circular reporting structure detected'
          break
        }
        const parentRole = existingRoles.find(r => r.id === currentParentId)
        currentParentId = parentRole ? parentRole.reportsTo : null
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        category: form.category,
        baseRole: form.baseRole || baseRoleForCategory(form.category),
        reportsTo: form.reportsTo || null,
        status: form.status === 'Active' ? 'active' : 'inactive',
      }
      if (isEditing) await rolesApi.update(roleToEdit.id, payload)
      else await rolesApi.create(payload)
      toast.success(isEditing ? 'Role updated' : 'Role created')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save role')
    } finally {
      setBusy(false)
    }
  }

  // Handle unsaved changes close
  const handleClose = () => {
    const hasUnsavedChanges = !isEditing 
      ? (form.name || form.description || form.category || form.reportsTo) 
      : (form.name !== roleToEdit.name || form.description !== roleToEdit.description || form.category !== roleToEdit.category || form.status !== roleToEdit.status || form.reportsTo !== (roleToEdit.reportsTo || ''))
    
    if (hasUnsavedChanges && !isSystem) {
      if (window.confirm('Discard changes?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? 'Edit Role' : 'Create Role'}>
      {isSystem && (
        <div className="mb-4 rounded-lg bg-blue-50 p-4 border border-blue-100 flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-600 mt-0.5">info</span>
          <div>
            <h4 className="text-sm font-semibold text-blue-900">System Role</h4>
            <p className="mt-1 text-sm text-blue-700">This is a protected system role and cannot be modified.</p>
          </div>
        </div>
      )}

      <div className="space-y-4 py-2">
        <div>
          <Input 
            label="Role Name" 
            placeholder="e.g. Regional Manager" 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})} 
            disabled={isSystem}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <Textarea 
            label="Description (Optional)" 
            placeholder="Brief description of the role's responsibilities" 
            value={form.description} 
            onChange={e => setForm({...form, description: e.target.value})} 
            disabled={isSystem}
          />
        </div>

        <div>
          <Select 
            label="Category" 
            value={form.category} 
            onChange={e => setForm({...form, category: e.target.value})}
            disabled={isSystem}
          >
            <option value="">Select Category...</option>
            {ROLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
        </div>

        <div>
          <Select
            label="Access Tier (enforcement level)"
            value={form.baseRole}
            onChange={e => setForm({...form, baseRole: e.target.value})}
            disabled={isSystem}
          >
            {BASE_ROLES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </Select>
          <p className="mt-1 text-xs text-slate-400">Determines the base authority tier; fine-grained module access is set in the permission builder.</p>
        </div>

        <div>
          <Select
            label="Reports To"
            value={form.reportsTo} 
            onChange={e => setForm({...form, reportsTo: e.target.value})}
            disabled={isSystem}
          >
            <option value="">No Parent (Top Level)</option>
            {existingRoles.filter(r => !isEditing || r.id !== roleToEdit.id).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
          {errors.reportsTo && <p className="mt-1 text-xs text-red-600">{errors.reportsTo}</p>}
        </div>

        <div>
          <Select 
            label="Status" 
            value={form.status} 
            onChange={e => setForm({...form, status: e.target.value})}
            disabled={isSystem}
          >
            {ROLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClose}>Cancel</Button>
        {!isSystem && (
          <Button variant="primary" onClick={handleSave} loading={busy}>{isEditing ? 'Save Changes' : 'Create Role'}</Button>
        )}
      </div>
    </Modal>
  )
}
