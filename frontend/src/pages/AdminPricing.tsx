import { useEffect, useState } from 'react'
import { 
  Crown, 
  Pencil, 
  Trash2, 
  Plus,
  Loader2,
  Check,
  X
} from 'lucide-react'
import { apiClient } from '../api/client'
import type { PricingPlan } from '../api/types'

export function AdminPricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: 'Premium Lifetime',
    description: 'Full access to ExitAI Ethiopia',
    amount: 500,
    currency: 'ETB',
    features: [] as string[],
    is_active: true
  })

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/api/payments/pricing')
      const data = Array.isArray(res.data) ? res.data : [res.data]
      setPlans(data)
    } catch {
      setError('Failed to load pricing plans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleCreate = async () => {
    try {
      await apiClient.post('/api/payments/pricing', formData)
      setShowCreateForm(false)
      fetchPlans()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to create plan')
    }
  }

  const handleUpdate = async (planId: string) => {
    try {
      await apiClient.put(`/api/payments/pricing/${planId}`, formData)
      setEditingPlan(null)
      fetchPlans()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to update plan')
    }
  }

  const handleArchive = async (planId: string) => {
    if (!window.confirm('Archive this plan?')) return
    try {
      await apiClient.delete(`/api/payments/pricing/${planId}`)
      fetchPlans()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to archive plan')
    }
  }

  const handleEditClick = (plan: PricingPlan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      description: plan.description || '',
      amount: plan.amount,
      currency: plan.currency,
      features: plan.features || [],
      is_active: plan.is_active
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage premium pricing plans</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold"></button>
        </div>
      )}

      {/* Plans List */}
      <div className="space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="font-bold text-gray-900">{plan.name}</span>
                {plan.is_active ? (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Active</span>
                ) : (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>
                )}
              </div>
              <p className="text-2xl font-black text-indigo-600">
                {plan.amount} {plan.currency}
              </p>
              {plan.description && (
                <p className="text-xs text-gray-500">{plan.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEditClick(plan)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleArchive(plan.id)}
                className="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Create Modal */}
      {(showCreateForm || editingPlan) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">
              {editingPlan ? 'Edit Plan' : 'Create Plan'}
            </h2>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-700 mb-1">Currency</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                className="h-4 w-4"
              />
              <label className="text-sm text-gray-700">Active</label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={editingPlan ? () => handleUpdate(editingPlan.id) : handleCreate}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingPlan ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setEditingPlan(null)
                }}
                className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}