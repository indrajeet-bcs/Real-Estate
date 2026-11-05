import TasksManagementPage from '../tasks/TasksManagementPage.jsx'

export default function SubAdminTasksPage() {
  return (
    <TasksManagementPage
      title="Branch Task Management"
      subtitle="Assign, monitor, and track tasks for your branch sales executives."
      isSubAdmin
    />
  )
}

