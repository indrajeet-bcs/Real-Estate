import { useState, useEffect, useCallback, useRef } from 'react'
import { companyBrandingApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Button, Input, Select, Loader, ErrorState, Toggle } from '../../components/ui.jsx'

const DEFAULT_BRANDING = {
  logo: null,
  favicon: null,
  primaryColor: '#0f172a',
  secondaryColor: '#3b82f6',
  companyNameDisplay: 'standard', // 'standard' | 'legal'
  loginBrandingEnabled: true
}

// Simple luminance check for contrast warning
function getLuminance(hex) {
  let color = (hex.charAt(0) === '#') ? hex.substring(1, 7) : hex
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('')
  }
  const r = parseInt(color.substring(0, 2), 16) / 255
  const g = parseInt(color.substring(2, 4), 16) / 255
  const b = parseInt(color.substring(4, 6), 16) / 255
  
  const a = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

function hasGoodContrastWithWhite(hex) {
  if (!/^#([0-9A-F]{3}){1,2}$/i.test(hex)) return true // ignore invalid
  const L = getLuminance(hex)
  const contrast = (1 + 0.05) / (L + 0.05)
  return contrast >= 3.0 // AA large text
}

function SettingsSection({ title, hint, children }) {
  return (
    <Card className="mt-6 p-6">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </Card>
  )
}

function ImageUpload({ label, value, onChange, onRemove, editing, hint, placeholderIcon }) {
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      onChange(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {hint && <span className="block text-xs text-slate-500 mb-3">{hint}</span>}
      
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 shrink-0 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
          {value ? (
             <img src={value} alt={label} className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="material-symbols-outlined text-slate-300 text-4xl">{placeholderIcon}</span>
          )}
        </div>
        
        {editing && (
          <div className="flex flex-col gap-2">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              {value ? 'Replace' : 'Upload'}
            </Button>
            {value && (
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onRemove}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ColorPicker({ label, value, onChange, editing }) {
  const [localHex, setLocalHex] = useState(value)
  const isValid = /^#([0-9A-F]{3}){1,2}$/i.test(localHex)
  const contrastWarning = isValid && !hasGoodContrastWithWhite(localHex)

  useEffect(() => {
    setLocalHex(value)
  }, [value])

  const handleHexChange = (e) => {
    const val = e.target.value
    setLocalHex(val)
    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      onChange(val)
    }
  }

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input 
              type="color" 
              value={isValid ? localHex : '#000000'} 
              onChange={(e) => { setLocalHex(e.target.value); onChange(e.target.value); }} 
              className="w-10 h-10 p-1 bg-white border border-slate-200 rounded cursor-pointer"
            />
            <div className="w-32">
              <Input value={localHex} onChange={handleHexChange} placeholder="#000000" />
            </div>
          </div>
          {!isValid && <p className="text-xs text-red-600">Enter a valid HEX color code.</p>}
          {isValid && contrastWarning && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              This color may not provide sufficient contrast for white text overlays.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 mt-2">
          <div className="w-8 h-8 rounded border border-slate-200" style={{ backgroundColor: value }} />
          <span className="text-sm text-slate-700 font-mono">{value}</span>
        </div>
      )}
    </div>
  )
}

export default function BrandingSettingsTab() {
  const toast = useToast()

  const { data, loading, error, refetch } = useFetch(useCallback(async () => {
    try {
      const res = await companyBrandingApi.get()
      return res
    } catch (err) {
      if (err.response?.status === 404) {
        return { data: { data: DEFAULT_BRANDING } }
      }
      throw err
    }
  }, []))

  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) setForm(data.data || DEFAULT_BRANDING)
  }, [data])

  const handleCancel = () => {
    const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(data?.data || DEFAULT_BRANDING)
    if (hasUnsavedChanges) {
      if (!window.confirm('Unsaved changes\n\nYour branding changes have not been saved. Do you want to discard them?')) {
        return
      }
    }
    setForm(data?.data || DEFAULT_BRANDING)
    setEditing(false)
  }

  const handleSave = async () => {
    // Basic validation
    if (!/^#([0-9A-F]{3}){1,2}$/i.test(form.primaryColor) || !/^#([0-9A-F]{3}){1,2}$/i.test(form.secondaryColor)) {
      toast.error('Please ensure all colors are valid HEX codes.')
      return
    }

    setBusy(true)
    try {
      try {
        await companyBrandingApi.update(form)
      } catch (err) {
        if (err.response?.status !== 404) throw err
      }
      toast.success('Branding & appearance updated successfully.')
      refetch() 
      setEditing(false)
    } catch (err) {
      toast.error('Unable to update branding settings. No changes were saved.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !form) return <div className="mt-6"><Loader /></div>
  if (error && error.response?.status !== 404) return <div className="mt-6"><ErrorState message="Unable to load branding settings." onRetry={refetch} /></div>

  return (
    <div className="animate-fade-in flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 w-full space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Customize your company's visual identity across supported CRM experiences.</p>
          {!editing ? (
            <Button onClick={() => setEditing(true)} variant="secondary" size="sm">Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleCancel} variant="ghost" size="sm" disabled={busy}>Cancel</Button>
              <Button onClick={handleSave} variant="primary" size="sm" loading={busy}>Save Changes</Button>
            </div>
          )}
        </div>

        {/* 1. Brand Assets */}
        <SettingsSection title="Brand Assets" hint="Upload your company logo and favicon.">
          <div className="grid sm:grid-cols-2 gap-8">
            <ImageUpload 
              label="Company Logo" 
              hint="Used in the application header and login screen."
              placeholderIcon="image"
              value={form.logo} 
              editing={editing} 
              onChange={val => setForm(f => ({ ...f, logo: val }))} 
              onRemove={() => {
                if(window.confirm('Remove this branding asset?')) setForm(f => ({ ...f, logo: null }))
              }} 
            />
            <ImageUpload 
              label="Favicon" 
              hint="Small icon displayed in the browser tab."
              placeholderIcon="tab"
              value={form.favicon} 
              editing={editing} 
              onChange={val => setForm(f => ({ ...f, favicon: val }))} 
              onRemove={() => {
                if(window.confirm('Remove this branding asset?')) setForm(f => ({ ...f, favicon: null }))
              }} 
            />
          </div>
        </SettingsSection>

        {/* 2. Brand Colors */}
        <SettingsSection title="Brand Colors" hint="Select primary and secondary colors for branded UI elements.">
          <div className="grid sm:grid-cols-2 gap-8">
            <ColorPicker 
              label="Primary Brand Color" 
              value={form.primaryColor} 
              onChange={val => setForm(f => ({ ...f, primaryColor: val }))} 
              editing={editing} 
            />
            <ColorPicker 
              label="Secondary / Accent Color" 
              value={form.secondaryColor} 
              onChange={val => setForm(f => ({ ...f, secondaryColor: val }))} 
              editing={editing} 
            />
          </div>
        </SettingsSection>

        {/* 3. General Branding Settings */}
        <SettingsSection title="General Branding" hint="Configure text and login screen behaviors.">
          <div className="space-y-6">
            <div className="max-w-xs">
              <span className="block text-sm font-medium text-slate-700 mb-1">Company Name Display</span>
              {editing ? (
                <Select value={form.companyNameDisplay} onChange={e => setForm(f => ({ ...f, companyNameDisplay: e.target.value }))}>
                  <option value="standard">Standard Name</option>
                  <option value="legal">Legal Entity Name</option>
                </Select>
              ) : (
                <p className="mt-1 text-sm text-slate-900">{form.companyNameDisplay === 'legal' ? 'Legal Entity Name' : 'Standard Name'}</p>
              )}
            </div>

            <div className="flex items-center justify-between py-1 max-w-xl">
              <div>
                <p className="text-sm font-medium text-slate-900">Enable Company Branding on Login</p>
                <p className="text-xs text-slate-500 mt-0.5">Apply your logo and primary color to the sign-in experience.</p>
              </div>
              {editing ? (
                <Toggle checked={form.loginBrandingEnabled} onChange={(v) => setForm(f => ({ ...f, loginBrandingEnabled: v }))} hideLabel label="Login Branding" />
              ) : (
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                  form.loginBrandingEnabled ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10'
                }`}>
                  {form.loginBrandingEnabled ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>
          </div>
        </SettingsSection>
      </div>

      {/* Right Sidebar: Live Preview */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="sticky top-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 ml-1">Live Preview</h3>
          <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm">
            {/* Header Preview */}
            <div className="h-12 border-b border-slate-200 px-4 flex items-center gap-3 bg-white">
              {form.logo ? (
                <img src={form.logo} alt="Logo" className="h-6 object-contain" />
              ) : (
                <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-slate-400">image</span>
                </div>
              )}
              <span className="text-sm font-bold truncate" style={{ color: form.primaryColor }}>
                {form.companyNameDisplay === 'legal' ? 'ABC Realty Pvt. Ltd.' : 'ABC Realty'}
              </span>
            </div>

            {/* Login Screen Preview (abstract) */}
            <div className="bg-slate-50 p-6 flex flex-col items-center justify-center h-48 relative overflow-hidden">
              {form.loginBrandingEnabled ? (
                <div className="w-48 bg-white rounded-lg shadow-sm border border-slate-100 p-4 text-center z-10">
                   {form.logo ? (
                    <img src={form.logo} alt="Logo" className="h-8 mx-auto mb-3 object-contain" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">image</span>
                    </div>
                  )}
                  <div className="h-2 w-3/4 mx-auto rounded mb-2 bg-slate-100" />
                  <div className="h-2 w-1/2 mx-auto rounded mb-4 bg-slate-100" />
                  <div className="h-6 w-full rounded mt-4" style={{ backgroundColor: form.primaryColor }} />
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-center">
                  <span className="material-symbols-outlined block text-2xl mb-1">lock</span>
                  Standard Login
                </div>
              )}
              
              {/* Decorative accent */}
              <div 
                className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-10" 
                style={{ backgroundColor: form.secondaryColor }} 
              />
            </div>
            
            {/* Color Swatches Info */}
            <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-4 text-xs font-mono text-slate-500">
               <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: form.primaryColor}}></div> PRI</div>
               <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: form.secondaryColor}}></div> SEC</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
