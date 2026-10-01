import { useState } from 'react'
import { PageHeader } from '../../components/ui.jsx'
import CompanyProfileTab from './CompanyProfileTab.jsx'
import CompanyPreferencesTab from './CompanyPreferencesTab.jsx'
import NotificationPreferencesTab from './NotificationPreferencesTab.jsx'
import SecuritySettingsTab from './SecuritySettingsTab.jsx'
import MasterDataTab from './MasterDataTab.jsx'
import BrandingSettingsTab from './BrandingSettingsTab.jsx'
import BusinessConfigTab from './BusinessConfigTab.jsx'

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
        active 
          ? 'bg-blue-50 text-blue-700' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      {label}
    </button>
  )
}

export default function OfficeSettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader 
        title="Company Settings" 
        subtitle="Manage company-wide settings and operational preferences." 
      />

      <div className="mt-8 flex flex-col md:flex-row md:items-start gap-8">
        {/* Settings Navigation */}
        <div className="w-full shrink-0 md:w-64">
          <nav className="flex flex-col gap-1">
            <NavItem 
              icon="business" 
              label="Company Profile" 
              active={activeTab === 'profile'} 
              onClick={() => setActiveTab('profile')} 
            />
            <NavItem 
              icon="tune" 
              label="Company Preferences" 
              active={activeTab === 'preferences'} 
              onClick={() => setActiveTab('preferences')} 
            />
            <NavItem 
              icon="domain_verification" 
              label="Business Configuration" 
              active={activeTab === 'businessconfig'} 
              onClick={() => setActiveTab('businessconfig')} 
            />
            <NavItem 
              icon="notifications" 
              label="Notification Preferences" 
              active={activeTab === 'notifications'} 
              onClick={() => setActiveTab('notifications')} 
            />
            <NavItem 
              icon="security" 
              label="Security Settings" 
              active={activeTab === 'security'} 
              onClick={() => setActiveTab('security')} 
            />
            <NavItem 
              icon="database" 
              label="Master Data" 
              active={activeTab === 'masterdata'} 
              onClick={() => setActiveTab('masterdata')} 
            />
            <NavItem 
              icon="palette" 
              label="Branding & Appearance" 
              active={activeTab === 'branding'} 
              onClick={() => setActiveTab('branding')} 
            />
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && <CompanyProfileTab />}
          {activeTab === 'preferences' && <CompanyPreferencesTab />}
          {activeTab === 'businessconfig' && <BusinessConfigTab />}
          {activeTab === 'notifications' && <NotificationPreferencesTab />}
          {activeTab === 'security' && <SecuritySettingsTab />}
          {activeTab === 'masterdata' && <MasterDataTab />}
          {activeTab === 'branding' && <BrandingSettingsTab />}
        </div>
      </div>
    </div>
  )
}
