import { useCallback } from 'react'
import { rolesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'

// Shared loader for the permission-builder wizard steps: fetches the real role
// (+ the role list for the step's role selector) and exposes a `saveSlice`
// helper that persists a designer slice to the backend.
export function useRoleWizard(id) {
  const { data: role, refetch } = useFetch(useCallback(() => rolesApi.get(id), [id]))
  const { data: rolesList } = useFetch(useCallback(() => rolesApi.list(), []))

  const roleData = role
    ? {
        id: role._id, name: role.name,
        type: role.type === 'system' ? 'System Role' : 'Custom Role',
        status: role.status === 'active' ? 'Active' : 'Inactive',
        category: role.category, designer: role.designer || {},
      }
    : null
  const availableRoles = (rolesList || []).map((r) => ({ id: r._id, name: r.name }))
  const moduleAccess = role?.designer?.moduleAccess || {}

  const saveSlice = (slice) => rolesApi.update(id, { designer: { ...(role?.designer || {}), ...slice } })

  return { role, roleData, availableRoles, moduleAccess, saveSlice, refetch }
}
