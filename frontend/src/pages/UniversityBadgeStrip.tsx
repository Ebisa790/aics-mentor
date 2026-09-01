// src/components/UniversityBadgeStrip.tsx
import { Building2, ShieldCheck } from 'lucide-react'

const UNIVERSITIES = [
  { name: 'Jimma University', code: 'JU' },
  { name: 'Addis Ababa University', code: 'AAU' },
  { name: 'Bahir Dar University', code: 'BDU' },
  { name: 'Hawassa University', code: 'HU' },
  { name: 'Haramaya University', code: 'HRU' },
  { name: 'Arba Minch University', code: 'AMU' },
  { name: 'Mekelle University', code: 'MU' },
  { name: 'University of Gondar', code: 'UOG' },
]

export function UniversityBadgeStrip() {
  return (
    <section className="border-y border-border/60 bg-slate-900/5 py-3.5 px-4 overflow-hidden relative">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
        
        {/* Left Label */}
        <div className="flex items-center space-x-2 shrink-0 z-10 bg-canvas/80 backdrop-blur-sm pr-3 py-1 rounded-r-lg">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-ink/80 tracking-tight whitespace-nowrap">
            Aligned for BSc CS Exit Exams Across:
          </span>
        </div>

        {/* Scrollable Container with Left Padding so text isn't cut off */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto py-1 justify-start lg:justify-start no-scrollbar scroll-smooth pl-1 pr-4">
          {UNIVERSITIES.map((uni) => (
            <div
              key={uni.code}
              className="group relative flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-border/80 text-ink/80 shadow-2xs hover:border-primary/50 hover:shadow-sm transition-all shrink-0 cursor-default"
            >
              <span className="whitespace-nowrap">{uni.name}</span>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md group-hover:bg-primary group-hover:text-white transition-colors">
                {uni.code}
              </span>
            </div>
          ))}
        </div>

        {/* Right Badge Tag */}
        <div className="hidden xl:flex items-center space-x-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="whitespace-nowrap">MoE Curriculum Standard</span>
        </div>

      </div>
    </section>
  )
}