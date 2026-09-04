import { useState, useRef, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react'
import { userApi, deviceApi, supportApi, type Device } from '../api'
import { Crown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

function formatLastActive(isoString: string): string {
  if (!isoString) return 'Unknown'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  const now = new Date()
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (secondsAgo < 60) return 'Just now'
  const minutesAgo = Math.floor(secondsAgo / 60)
  if (minutesAgo < 60) return `${minutesAgo}m ago`
  const hoursAgo = Math.floor(minutesAgo / 60)
  if (hoursAgo < 24) return `${hoursAgo}h ago`
  const daysAgo = Math.floor(hoursAgo / 24)
  if (daysAgo < 7) return `${daysAgo}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response
    if (response?.data?.detail) return response.data.detail
  }
  if (err instanceof Error) return err.message
  return fallback
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'support'>('profile')

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [university, setUniversity] = useState('')
  const [yearOfStudy, setYearOfStudy] = useState('')
  const [examDate, setExamDate] = useState('')
  const [weeklyHours, setWeeklyHours] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [devices, setDevices] = useState<Device[]>([])
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const [is2FAEnabled, setIs2FAEnabled] = useState(false)
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [otpauthUri, setOtpauthUri] = useState('')
  const [twoFACode, setTwoFACode] = useState('')
  const [isVerifying2FA, setIsVerifying2FA] = useState(false)
  const [twoFAMethod, setTwoFAMethod] = useState<'app' | 'email'>('app')
  const [emailCodeSent, setEmailCodeSent] = useState(false)

  const [supportSubject, setSupportSubject] = useState('')
  const [supportMessage, setSupportMessage] = useState('')
  const [supportIssueType, setSupportIssueType] = useState('other')
  const [supportSuccess, setSupportSuccess] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setIs2FAEnabled(user.is_2fa_enabled ?? false)
      setFullName(user.full_name ?? '')
      setAvatarUrl(user.avatar_url ?? '')
      setUniversity(user.university ?? '')
      setYearOfStudy(user.year_of_study?.toString() ?? '')
      setExamDate(user.exam_date ?? '')
      setWeeklyHours(user.available_weekly_hours?.toString() ?? '')
    }
  }, [user])

  const fetchDevices = useCallback(async () => {
    setIsLoadingDevices(true)
    try {
      const data = await deviceApi.listDevices()
      setDevices(data)
    } catch (err) {
      console.error('Failed to load active devices:', err)
      setError('Could not load active device sessions.')
    } finally {
      setIsLoadingDevices(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'security') fetchDevices()
  }, [activeTab, fetchDevices])

  const handleRevokeDevice = async (deviceId: string) => {
    setRevokingId(deviceId)
    const previousDevices = [...devices]
    setDevices((prev) => prev.filter((d) => d.id !== deviceId))
    try {
      await deviceApi.revokeDevice(deviceId)
    } catch (err) {
      setDevices(previousDevices)
      setError(getErrorMessage(err, 'Failed to revoke device session.'))
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeOtherDevices = async () => {
    setIsSaving(true)
    const previousDevices = [...devices]
    setDevices((prev) => prev.filter((d) => d.is_current_device))
    try {
      await deviceApi.revokeOtherDevices()
      setSaved(true)
    } catch (err) {
      setDevices(previousDevices)
      setError(getErrorMessage(err, 'Failed to revoke other devices.'))
    } finally {
      setIsSaving(false)
    }
  }

  const userInitials = fullName
    ? fullName.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'US'

  const handleInputChange = (setter: (val: string) => void) => (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setter(e.target.value)
    setSaved(false)
    setError(null)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Image size should be less than 2MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string)
      setSaved(false)
      setError(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setAvatarUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSaved(false)
    setError(null)
  }

  const resetAlerts = () => {
    setError(null)
    setSaved(false)
    setSupportSuccess(false)
  }

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    resetAlerts()
    try {
      await userApi.updateProfile({
        full_name: fullName.trim() || undefined,
        avatar_url: avatarUrl || undefined,
        university: university.trim() || undefined,
        year_of_study: yearOfStudy ? Number(yearOfStudy) : undefined,
        exam_date: examDate || undefined,
        available_weekly_hours: weeklyHours ? Number(weeklyHours) : undefined,
      })
      await refreshUser()
      setSaved(true)
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update your profile. Please try again."))
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    resetAlerts()
    if (!currentPassword) { setError('Please enter your current password.'); return }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters long.'); return }
    setIsSaving(true)
    try {
      await userApi.changePassword({ current_password: currentPassword, new_password: newPassword })
      setSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to change password. Please verify your current password.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handle2FASetup = async () => {
    setError(null)
    setShow2FASetup(true)
    setTwoFAMethod('app')
    setEmailCodeSent(false)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/2fa/setup`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || '') },
      })
      const data = await res.json()
      if (data.otpauth_uri) setOtpauthUri(data.otpauth_uri)
    } catch {
      setError('Failed to setup 2FA. Please try again.')
    }
  }

  const handleEmail2FASend = async () => {
    setError(null)
    setIsVerifying2FA(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/2fa/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
        },
        body: JSON.stringify({ email: user?.email || '' }),
      })
      const data = await res.json()
      if (res.ok) {
        setEmailCodeSent(true)
      } else {
        setError(data.detail || 'Could not send verification code.')
      }
    } catch {
      setError('Could not send 2FA code. Please try again.')
    } finally {
      setIsVerifying2FA(false)
    }
  }

  const handle2FAVerify = async () => {
    if (!twoFACode.trim()) return
    setIsVerifying2FA(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
        },
        body: JSON.stringify({ code: twoFACode }),
      })
      const data = await res.json()
      if (res.ok) {
        setIs2FAEnabled(true)
        setShow2FASetup(false)
        setTwoFACode('')
        setSaved(true)
      } else {
        setError(data.detail || 'Invalid code. Please try again.')
      }
    } catch {
      setError('Failed to verify 2FA. Please try again.')
    } finally {
      setIsVerifying2FA(false)
    }
  }

  const handle2FADisable = async () => {
    if (!twoFACode.trim()) return
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/2fa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
        },
        body: JSON.stringify({ code: twoFACode }),
      })
      const data = await res.json()
      if (res.ok) {
        setIs2FAEnabled(false)
        setTwoFACode('')
        setSaved(true)
      } else {
        setError(data.detail || 'Invalid code. Cannot disable 2FA.')
      }
    } catch {
      setError('Failed to disable 2FA. Please try again.')
    }
  }

  const handleSupportSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supportSubject.trim() || !supportMessage.trim()) return
    setIsSaving(true)
    resetAlerts()
    try {
      await supportApi.sendTicket({ subject: supportSubject.trim(), message: supportMessage.trim(), issue_type: supportIssueType, email: user?.email || '' })
      setSupportSuccess(true)
      setSupportSubject('')
      setSupportMessage('')
      setSupportIssueType('other')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send support ticket. Please try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return null

  const hasOtherDevices = devices.length > 1 && devices.some((d) => !d.is_current_device)

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Settings & Profile</h1>
          {user.subscription_tier === 'premium' && (
            <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full text-xs font-bold">
              <Crown className="w-3.5 h-3.5 fill-amber-500" /> Premium
            </span>
          )}
        </div>
        <p className="text-slate-500 text-sm mt-1">Manage your personal details, active sessions, security preferences, or get support.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6" role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === 'profile'} onClick={() => { setActiveTab('profile'); resetAlerts(); }} className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'profile' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>👤 Profile Details</button>
        <button type="button" role="tab" aria-selected={activeTab === 'security'} onClick={() => { setActiveTab('security'); resetAlerts(); }} className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'security' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>🔒 Security & Devices</button>
        <button type="button" role="tab" aria-selected={activeTab === 'support'} onClick={() => { setActiveTab('support'); resetAlerts(); }} className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'support' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>🎧 Help & Support</button>
      </div>

      {saved && <div className="text-sm font-medium text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center justify-between"><span>✅ Changes updated successfully.</span></div>}
      {error && <div className="text-sm font-medium text-red-600 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>}

      {/* TAB 1: PROFILE DETAILS */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="card p-6 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2"><span>🖼️</span> Profile Picture</h2>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative shrink-0 group">
                {avatarUrl ? <img src={avatarUrl} alt={fullName || 'Profile'} className="h-20 w-20 rounded-full object-cover ring-4 ring-emerald-500/30 shadow-md" /> : <div className="h-20 w-20 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xl flex items-center justify-center border-2 border-emerald-500/30">{userInitials}</div>}
              </div>
              <div className="flex-1 w-full space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-all">Upload Photo</button>
                  {avatarUrl && <button type="button" onClick={handleRemovePhoto} className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all">Remove</button>}
                </div>
                <input type="url" placeholder="Or enter direct image URL" className="input text-xs" value={avatarUrl} onChange={handleInputChange(setAvatarUrl)} />
              </div>
            </div>
          </div>
          <div className="card p-6 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Full Name</label><input type="text" className="input" value={fullName} onChange={handleInputChange(setFullName)} /></div>
              <div><label className="label">Email Address</label><input type="email" disabled value={user.email} className="input bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed" /></div>
              <div><label className="label">University</label><input type="text" className="input" value={university} onChange={handleInputChange(setUniversity)} /></div>
              <div><label className="label">Year of Study</label><input type="number" min={1} max={6} className="input" value={yearOfStudy} onChange={handleInputChange(setYearOfStudy)} /></div>
              <div><label className="label">Exit Exam Date</label><input type="date" className="input" value={examDate} onChange={handleInputChange(setExamDate)} /></div>
              <div><label className="label">Available Weekly Study Hours</label><input type="number" min={0} className="input" value={weeklyHours} onChange={handleInputChange(setWeeklyHours)} /></div>
            </div>
          </div>
          <button type="submit" disabled={isSaving} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-50">{isSaving ? 'Saving…' : 'Save Profile Settings'}</button>
        </form>
      )}

      {/* TAB 2: SECURITY & DEVICES */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <form onSubmit={handlePasswordSubmit} className="card p-6 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2"><span>🔑</span> Change Password</h2>
            <div className="space-y-3">
              <div><label className="label">Current Password</label><input type="password" required className="input" placeholder="••••••••" value={currentPassword} onChange={handleInputChange(setCurrentPassword)} /></div>
              <div><label className="label">New Password</label><input type="password" required className="input" placeholder="At least 6 characters" value={newPassword} onChange={handleInputChange(setNewPassword)} /></div>
              <div><label className="label">Confirm New Password</label><input type="password" required className="input" placeholder="Repeat new password" value={confirmPassword} onChange={handleInputChange(setConfirmPassword)} /></div>
            </div>
            <button type="submit" disabled={isSaving} className="py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all disabled:opacity-50">{isSaving ? 'Updating Password…' : 'Update Password'}</button>
          </form>

          {/* 2FA */}
          <div className="card p-6 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2"><span>🔐</span> Two-Factor Authentication</h2>
                <p className="text-xs text-slate-500 mt-0.5">Add an extra layer of security using Google Authenticator or Email.</p>
              </div>
              {is2FAEnabled ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">✓ Enabled</span> : <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">Disabled</span>}
            </div>

            {!is2FAEnabled && !show2FASetup && (
              <div className="flex gap-3">
                <button onClick={handle2FASetup} className="py-2.5 px-5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-all">Use Google Authenticator</button>
                <button onClick={() => { setShow2FASetup(true); setTwoFAMethod('email'); setEmailCodeSent(false); }} className="py-2.5 px-5 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-all">Use Email Code</button>
              </div>
            )}

            {show2FASetup && !is2FAEnabled && twoFAMethod === 'app' && (
              <div className="space-y-3">
                {otpauthUri && (
                  <div className="p-4 bg-slate-50 rounded-xl text-center space-y-2">
                    <p className="text-xs text-slate-500">Scan with Google Authenticator:</p>
                    <img src={'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(otpauthUri)} alt="2FA QR Code" className="mx-auto rounded-lg" />
                  </div>
                )}
                <div><label className="label">Enter 6-digit code from app</label><input type="text" maxLength={6} placeholder="000000" value={twoFACode} onChange={(e) => setTwoFACode(e.target.value)} className="input text-center text-2xl tracking-widest font-mono" /></div>
                <button onClick={handle2FAVerify} disabled={isVerifying2FA || twoFACode.length !== 6} className="py-2.5 px-5 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50">{isVerifying2FA ? 'Verifying...' : 'Verify & Enable'}</button>
              </div>
            )}

            {show2FASetup && !is2FAEnabled && twoFAMethod === 'email' && (
              <div className="space-y-3">
                {!emailCodeSent ? (
                  <>
                    <p className="text-xs text-slate-500">We'll send a 6-digit verification code to {user?.email}.</p>
                    <button onClick={handleEmail2FASend} disabled={isVerifying2FA} className="py-2.5 px-5 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50">{isVerifying2FA ? 'Sending...' : 'Send Verification Code'}</button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">Code sent to {user?.email}</p>
                    <div><label className="label">Enter 6-digit code from email</label><input type="text" maxLength={6} placeholder="000000" value={twoFACode} onChange={(e) => setTwoFACode(e.target.value)} className="input text-center text-2xl tracking-widest font-mono" /></div>
                    <button onClick={handle2FAVerify} disabled={isVerifying2FA || twoFACode.length !== 6} className="py-2.5 px-5 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50">{isVerifying2FA ? 'Verifying...' : 'Verify & Enable'}</button>
                  </>
                )}
              </div>
            )}

            {is2FAEnabled && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={() => { setTwoFAMethod('app'); setEmailCodeSent(false); }} className={`py-2 px-4 text-xs font-bold rounded-xl transition-all ${twoFAMethod === 'app' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Authenticator</button>
                  <button onClick={() => { setTwoFAMethod('email'); setEmailCodeSent(false); }} className={`py-2 px-4 text-xs font-bold rounded-xl transition-all ${twoFAMethod === 'email' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>Email</button>
                </div>
                {twoFAMethod === 'app' ? (
                  <>
                    <p className="text-xs text-slate-500">Enter current Google Authenticator code to disable:</p>
                    <input type="text" maxLength={6} placeholder="000000" value={twoFACode} onChange={(e) => setTwoFACode(e.target.value)} className="input text-center text-2xl tracking-widest font-mono max-w-[150px]" />
                    <button onClick={handle2FADisable} disabled={twoFACode.length !== 6} className="py-2 px-4 bg-rose-500 text-white font-bold text-xs rounded-xl hover:bg-rose-600 transition-all disabled:opacity-50">Disable 2FA</button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">We'll send a 6-digit code to {user?.email} to disable:</p>
                    {!emailCodeSent ? (
                      <button onClick={handleEmail2FASend} disabled={isVerifying2FA} className="py-2 px-4 bg-emerald-500 text-white font-bold text-xs rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50">{isVerifying2FA ? 'Sending...' : 'Send Code'}</button>
                    ) : (
                      <>
                        <input type="text" maxLength={6} placeholder="000000" value={twoFACode} onChange={(e) => setTwoFACode(e.target.value)} className="input text-center text-2xl tracking-widest font-mono max-w-[150px]" />
                        <button onClick={handle2FADisable} disabled={twoFACode.length !== 6} className="py-2 px-4 bg-rose-500 text-white font-bold text-xs rounded-xl hover:bg-rose-600 transition-all disabled:opacity-50">Disable 2FA</button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Active Devices */}
          <div className="card p-6 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2"><span>📱</span> Active Devices & Logged-In Sessions</h2>
                <p className="text-xs text-slate-500 mt-0.5">Manage devices and browser sessions currently authenticated with your account.</p>
              </div>
              {hasOtherDevices && <button type="button" onClick={handleRevokeOtherDevices} disabled={isSaving} className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all disabled:opacity-50">Sign Out Other Devices</button>}
            </div>
            <div className="space-y-3 pt-2">
              {isLoadingDevices ? <p className="text-xs text-slate-500 py-4 text-center">Loading active devices...</p> : devices.length === 0 ? <p className="text-xs text-slate-500 py-4 text-center">No active devices found.</p> : devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-lg">{device.device_type === 'mobile' ? '📱' : device.device_type === 'tablet' ? '📑' : '💻'}</div>
                    <div>
                      <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-900 dark:text-slate-100">{device.device_name}</span></div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{device.browser} • {device.ip_address} • Last active: {formatLastActive(device.last_active)}</p>
                    </div>
                  </div>
                  {device.is_current_device ? <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Current Device</span> : <button type="button" onClick={() => handleRevokeDevice(device.id)} disabled={revokingId === device.id} className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">{revokingId === device.id ? 'Signing out...' : 'Revoke'}</button>}
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card p-6 border border-red-500/20 bg-red-500/5 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400">Danger Zone</h3>
            <p className="text-xs text-slate-500">Need to take a break or reset your progress? Contact support or initiate account deletion.</p>
            <button type="button" onClick={async () => { if (confirm('Are you sure you want to deactivate your account? You can request reactivation by contacting support.')) { try { await userApi.deleteAccount(); alert('Your account has been deactivated. You will be logged out.'); window.location.href = '/login'; } catch (err) { alert('Failed to deactivate account. Please try again.'); } } }} className="text-xs font-bold text-red-600 hover:underline">Request Account Deletion</button>
          </div>
        </div>
      )}

      {/* TAB 3: HELP & SUPPORT */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          {supportSuccess && <div className="text-sm font-medium text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">🎉 Your message has been sent! Our support team will get back to you shortly.</div>}
          <form onSubmit={handleSupportSubmit} className="card p-6 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2"><span>💬</span> Contact Platform Support</h2>
            <div className="space-y-3">
              <div><label className="label">Issue Type</label><select value={supportIssueType} onChange={(e) => setSupportIssueType(e.target.value)} className="input"><option value="account_reactivation">Account Reactivation Request</option><option value="account_issues">Account Issues</option><option value="payment">Payment/Billing</option><option value="technical">Technical Issue</option><option value="content">Course/Content Issue</option><option value="feedback">Feedback</option><option value="other">Other</option></select></div>
              <div><label className="label">Subject</label><input type="text" required placeholder="e.g. Issue with Exit Exam Practice Quiz" className="input" value={supportSubject} onChange={handleInputChange(setSupportSubject)} /></div>
              <div><label className="label">How can we help?</label><textarea rows={4} required placeholder="Describe your question or issue in detail..." className="input py-2" value={supportMessage} onChange={handleInputChange(setSupportMessage)} /></div>
            </div>
            <button type="submit" disabled={isSaving} className="py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all disabled:opacity-50">{isSaving ? 'Sending…' : 'Send Ticket'}</button>
          </form>
          <div className="card p-6 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Frequently Asked Questions</h3>
            <div className="space-y-2 text-xs text-slate-500">
              <details className="cursor-pointer border-b border-slate-200 dark:border-slate-800 pb-2"><summary className="font-semibold text-slate-700 dark:text-slate-300">How does the AI Tutor learn my focus areas?</summary><p className="mt-1 pl-2">The AI automatically tracks your quiz scores across different Computer Science topics and updates your strengths/weaknesses summary.</p></details>
              <details className="cursor-pointer border-b border-slate-200 dark:border-slate-800 pb-2"><summary className="font-semibold text-slate-700 dark:text-slate-300">Can I reset my study progress?</summary><p className="mt-1 pl-2">Yes, you can submit a request through the support form above to clear your quiz history.</p></details>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}