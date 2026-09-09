import { BookOpen, ChevronRight, Zap, Lock, Crown } from 'lucide-react';
import { Spinner } from '../components/Spinner';
import UpgradeModal from '../components/UpgradeModal';
import { EXAM_PRESETS } from './MockExamTypes';

interface MockExamConfigProps {
  selectedPreset: string;
  questionCount: number;
  timeLimitMinutes: number;
  enableProctoring: boolean;
  rulesAcknowledged: boolean;
  loading: boolean;
  isPremium: boolean;
  showUpgradeModal: boolean;
  onPresetSelect: (presetId: string) => void;
  onProctoringChange: (checked: boolean) => void;
  onRulesAcknowledgedChange: (checked: boolean) => void;
  onStartExam: (e: React.FormEvent) => void;
  onCancel: () => void;
  onUpgrade: () => void;
  onCloseUpgrade: () => void;
}

export function MockExamConfig({
  selectedPreset,
  questionCount,
  timeLimitMinutes,
  enableProctoring,
  rulesAcknowledged,
  loading,
  isPremium,
  showUpgradeModal,
  onPresetSelect,
  onProctoringChange,
  onRulesAcknowledgedChange,
  onStartExam,
  onCancel,
  onUpgrade,
  onCloseUpgrade,
}: MockExamConfigProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header Card */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-[#1b1b3a] text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute right-4 bottom-8 opacity-10 md:right-8 md:bottom-2 text-indigo-300">
          <BookOpen className="h-64 w-64 stroke-[1.2]" />
        </div>
        <div className="relative z-10 p-6 md:p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-200">
            <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span>National Standard Simulation</span>
          </div>
          <h1 className="mb-3 text-2xl md:text-4xl font-extrabold tracking-tight text-white">
            Computer Science Exit Exam Simulator
          </h1>
          <p className="max-w-2xl text-sm md:text-base leading-relaxed text-indigo-100/80">
            Complete Computer-Based Testing (CBT) environment modeling official MoE exit examination standards.
          </p>
        </div>
      </div>

      {/* Premium Status Banner */}
      {!isPremium && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-600">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Premium CBT Feature</h4>
              <p className="text-xs text-slate-600">
                Full Exit Exam Simulations and AI Deep-Dive Explanations require Premium access.
              </p>
            </div>
          </div>
          <button
            onClick={onUpgrade}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition active:scale-95 shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            <Crown className="h-3.5 w-3.5 fill-slate-950" />
            <span>Upgrade</span>
          </button>
        </div>
      )}

      {/* Exam Configuration Form */}
      <div className="bg-white shadow-sm rounded-2xl border border-slate-200 p-8 space-y-6">
        <form onSubmit={onStartExam} className="space-y-6">
          {/* Exam Preset Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Exam Format
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {EXAM_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onPresetSelect(preset.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all active:scale-95 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="mb-2">
                      <span className="font-bold text-slate-900 text-sm">{preset.label}</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      <p className="font-semibold">{preset.questions} questions</p>
                      <p>{preset.timeLimit} minutes</p>
                      <p className="text-slate-400 text-[11px]">{preset.description}</p>
                    </div>
                    <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {(preset.timeLimit / preset.questions).toFixed(1)} min per question
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Display */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Time Limit</p>
                <p className="text-xs text-slate-500 mt-0.5">Fixed based on exam format</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">{timeLimitMinutes} min</p>
                <p className="text-xs text-slate-400">{questionCount} questions</p>
              </div>
            </div>
          </div>

          {/* Proctoring Toggle */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
            <input
              type="checkbox"
              id="proctorToggle"
              checked={enableProctoring}
              onChange={(e) => onProctoringChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="proctorToggle" className="text-xs text-slate-700 cursor-pointer">
              <span className="font-bold block text-slate-900 mb-0.5">
                Enable Strict Proctoring (secure_flag)
              </span>
              Enforces full-screen, disables copy-pasting, monitors window blur/tab switches, and auto-submits on repeated security violations.
            </label>
          </div>

          {/* CBT Instructions */}
          <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl text-xs text-indigo-950 space-y-2">
            <p className="font-bold text-indigo-900 flex items-center gap-1">
              <span>Official CBT Instructions:</span>
            </p>
            <ul className="space-y-1 text-indigo-900/90 pl-1">
              <li>• Questions are sampled dynamically across all core computer science domains.</li>
              <li>• Use the Question Palette to track answered, flagged, and pending items.</li>
              <li>• Ensure a stable internet connection; answers are auto-saved locally in real time.</li>
            </ul>
            <label className="flex items-start gap-2.5 pt-2 border-t border-indigo-100 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rulesAcknowledged}
                onChange={(e) => onRulesAcknowledgedChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-indigo-950 leading-relaxed">
                I have read and agree to the official CBT examination rules and proctoring requirements.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!rulesAcknowledged || loading}
              className="flex-1 bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition active:scale-95 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {!isPremium && <Lock className="h-4 w-4 text-indigo-200" />}
              <span>
                {loading ? (
                  <Spinner size="lg" color="emerald" label="Initializing Secure Engine..." />
                ) : (
                  'Begin Mock Exam'
                )}
              </span>
              {!loading && <ChevronRight className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="border border-slate-300 px-6 py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-50 text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={onCloseUpgrade}
        customMessage="Get the full Mock Exam Engine with unlimited simulations, AI deep-dive explanations, and proctored testing."
      />
    </div>
  );
}