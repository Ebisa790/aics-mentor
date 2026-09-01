import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HeroIllustration } from '../components/HeroIllustration'
import { MasteryRing } from '../components/MasteryRing'
import { UniversityBadgeStrip } from '../pages/UniversityBadgeStrip'

import {
  BookOpen,
  Target,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Shield,
  GraduationCap,
  ChevronRight,
  Brain,
  HelpCircle,
  XCircle,
  Lightbulb,
  RotateCcw,
  Code2,
  Cpu,
  Network,
  X,
  Play,
  Clock3,
  BarChart3,
  ShieldCheck,
  Menu,
  MessageCircle,
  } from 'lucide-react'

const FEATURE_ICONS = [
  <MessageCircle className="h-5 w-5" key="0" />,
  <Target className="h-5 w-5" key="1" />,
  <ShieldCheck className="h-5 w-5" key="2" />,
  <TrendingUp className="h-5 w-5" key="3" />,
]

const FEATURES = [
  {
    title: 'Study Assistant',
    description:
      'Ask about any concept — deadlocks, normalization, TCP/IP — and get an exam-focused explanation.',
    accent: 'indigo',
  },
  {
    title: 'Practice and Mock Exams',
    description:
      'Practice with focused question sets or take a full timed exam using the real difficulty distribution.',
    accent: 'emerald',
  },
  {
    title: 'MoE-Aligned Curriculum',
    description:
      'Study across the official Computer Science competency framework with course codes and structured coverage.',
    accent: 'amber',
  },
  {
    title: 'Progress Tracking',
    description:
      'Track mastery by course and see exactly where you need more practice.',
    accent: 'purple',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Choose a course',
    description:
      'Select from the 16 Computer Science exit-exam courses and focus your study.',
    icon: BookOpen,
  },
  {
    n: '02',
    title: 'Practice with real questions',
    description:
      'Answer exam-style questions or take a full timed simulation.',
    icon: Brain,
  },
  {
    n: '03',
    title: 'Track your readiness',
    description:
      'Use course-level mastery to see where you should study next.',
    icon: BarChart3,
  },
]

const COURSE_PREVIEWS = [
  {
    name: 'Operating Systems',
    code: 'CoSc3101',
    focus: 'Process Synchronization, Deadlocks, Virtual Memory',
  },
  {
    name: 'Database Systems',
    code: 'CoSc2041',
    focus: 'Relational Algebra, ER Diagrams, Normalization (1NF–BCNF)',
  },
  {
    name: 'Computer Networks',
    code: 'CoSc3081',
    focus: 'OSI/TCP-IP Models, IP Addressing, Routing Protocols',
  },
  {
    name: 'Software Engineering',
    code: 'CoSc3062',
    focus: 'SDLC Methodologies, UML Diagrams, Testing Strategies',
  },
  {
    name: 'Data Structures and Algorithms',
    code: 'CoSc2011',
    focus: 'Asymptotic Analysis, Trees, Graph Algorithms, Sorting',
  },
  {
    name: 'Web Programming',
    code: 'CoSc3112',
    focus: 'Client-Side Scripting, Backend APIs, State and Security',
  },
]

const SAMPLE_QUESTIONS = [
  {
    id: 'q1',
    course: 'Database Systems',
    code: 'CoSc2041',
    topic: 'Database Normalization',
    icon: <Code2 className="h-4 w-4" />,
    question:
      'A table is in 2NF (Second Normal Form) if it is already in 1NF and additionally satisfies which of the following requirements?',
    options: [
      { id: 'A', text: 'It has no transitive dependencies.' },
      {
        id: 'B',
        text: 'All non-key attributes are fully functionally dependent on the primary key.',
      },
      {
        id: 'C',
        text: 'It contains multi-valued attributes in separate tables.',
      },
      { id: 'D', text: 'Every determinant is a candidate key.' },
    ],
    correctOption: 'B',
    explanation: {
      coreConcept: '2NF eliminates Partial Functional Dependencies.',
      breakdown: [
        '1NF requires atomic values (no repeating groups or multivalued fields).',
        '2NF requires being in 1NF and ensuring that all non-key attributes depend on the whole primary key.',
        'Option A defines 3NF because it removes transitive dependencies.',
        'Option D defines BCNF (Boyce-Codd Normal Form).',
      ],
      examTip:
        'If a table has a single-attribute primary key and is in 1NF, it is automatically in 2NF.',
    },
  },
  {
    id: 'q2',
    course: 'Operating Systems',
    code: 'CoSc3101',
    topic: 'Process Deadlocks',
    icon: <Cpu className="h-4 w-4" />,
    question:
      "Which of the following conditions is NOT one of Coffman's four necessary conditions for a deadlock to occur?",
    options: [
      { id: 'A', text: 'Mutual Exclusion' },
      { id: 'B', text: 'Hold and Wait' },
      { id: 'C', text: 'Preemption Allowed' },
      { id: 'D', text: 'Circular Wait' },
    ],
    correctOption: 'C',
    explanation: {
      coreConcept: 'Deadlock requires NO PREEMPTION, not preemption allowed.',
      breakdown: [
        'The four Coffman conditions are Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.',
        'If preemption is allowed, the OS can force a process to yield resources, preventing deadlocks.',
        'Eliminating any one of these four conditions guarantees that deadlocks cannot occur.',
      ],
      examTip:
        "Remember the four conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.",
    },
  },
  {
    id: 'q3',
    course: 'Computer Networks',
    code: 'CoSc3081',
    topic: 'TCP/IP Model and Addressing',
    icon: <Network className="h-4 w-4" />,
    question:
      'At which layer of the OSI model does a standard Layer-2 Switch operate?',
    options: [
      { id: 'A', text: 'Physical Layer (Layer 1)' },
      { id: 'B', text: 'Data Link Layer (Layer 2)' },
      { id: 'C', text: 'Network Layer (Layer 3)' },
      { id: 'D', text: 'Transport Layer (Layer 4)' },
    ],
    correctOption: 'B',
    explanation: {
      coreConcept:
        'Switches use MAC addresses to forward frames at the Data Link Layer.',
      breakdown: [
        'Layer 1 deals with raw bits and physical transmission.',
        'Layer 2 deals with MAC addresses, frames, and switches.',
        'Layer 3 deals with IP addresses, packets, and routers.',
      ],
      examTip:
        'MAC addressing and switching usually point to Layer 2. IP addressing and routing point to Layer 3.',
    },
  },
]

const accentStyles: Record<string, string> = {
  indigo:
    'bg-indigo-50 text-indigo-600 border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white',
  emerald:
    'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white',
  amber:
    'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-500 group-hover:text-white',
  purple:
    'bg-purple-50 text-purple-600 border-purple-100 group-hover:bg-purple-600 group-hover:text-white',
}

export function LandingPage() {
  const { user } = useAuth()

  const [selectedCourseIndex, setSelectedCourseIndex] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeQuestionId, setActiveQuestionId] = useState('q1')
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const primaryHref = user ? '/dashboard' : '/register'
  const primaryLabel = user ? 'Go to Dashboard' : 'Get Started Free'

  const currentQ =
    SAMPLE_QUESTIONS.find((q) => q.id === activeQuestionId) ||
    SAMPLE_QUESTIONS[0]

  const currentAnswer = userAnswers[currentQ.id]

  const handleOptionSelect = (optionId: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionId,
    }))
  }

  const handleResetCurrent = () => {
    setUserAnswers((prev) => {
      const copy = { ...prev }
      delete copy[currentQ.id]
      return copy
    })
  }

  const openPracticeModal = () => {
    setIsModalOpen(true)
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 overflow-x-hidden">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-200/30 blur-[120px]" />
        <div className="absolute top-[700px] -left-40 h-[400px] w-[400px] rounded-full bg-purple-200/20 blur-[100px]" />
        <div className="absolute top-[1500px] -right-40 h-[500px] w-[500px] rounded-full bg-blue-200/20 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 transition-transform duration-300 group-hover:scale-105">
              <GraduationCap className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
            </div>

            <div>
              <div className="text-[15px] font-black tracking-tight text-slate-950">
                ExitAI <span className="text-indigo-600">Ethiopia</span>
              </div>
              <div className="hidden text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">
                CS Exit Exam Preparation
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-2 md:flex">
            <a
              href="#features"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              Features
            </a>

            <a
              href="#courses"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              Courses
            </a>

            <a
              href="#how-it-works"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              How it works
            </a>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-indigo-600"
              >
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:text-indigo-600"
                >
                  Sign in
                </Link>

                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-indigo-600"
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 md:hidden"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-5 py-5 md:hidden">
            <div className="flex flex-col gap-1">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Features
              </a>

              <a
                href="#courses"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Courses
              </a>

              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                How it works
              </a>

              <div className="my-2 border-t border-slate-100" />

              {user ? (
                <Link
                  to="/dashboard"
                  className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="rounded-xl px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Sign in
                  </Link>

                  <Link
                    to="/register"
                    className="rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-bold text-white"
                  >
                    Get started free
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <main>
        <section className="relative px-5 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3.5 py-2 text-[11px] font-bold text-indigo-700 shadow-sm shadow-indigo-100/50">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50">
                  <GraduationCap className="h-3 w-3 text-indigo-600" />
                </span>
                Built for Ethiopia's CS Exit Exam
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                MoE-aligned
              </div>

              <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[4.25rem]">
                Study smarter.
                <br />
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                  Pass with confidence.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                A preparation platform for Ethiopian Computer Science
                students — with tutoring, exam-style practice, mock exams,
                and course-level readiness tracking.
              </p>

              {/* CTA */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={primaryHref}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/20 transition duration-300 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-indigo-600/30"
                >
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <button
                  onClick={openPracticeModal}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg hover:shadow-slate-200/50"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100">
                    <Play className="h-3 w-3 fill-current" />
                  </span>
                  Try sample questions
                </button>
              </div>

              {/* Trust */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Free to start
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  No card required
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Exam-focused
                </div>
              </div>

              {/* Stats */}
              <div className="mt-10 grid max-w-xl grid-cols-3 border-t border-slate-200 pt-7">
                <div className="border-r border-slate-200 pr-4">
                  <div className="text-2xl font-black tracking-tight text-slate-950">
                    16
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">
                    CS Courses
                  </div>
                </div>

                <div className="border-r border-slate-200 px-4">
                  <div className="text-2xl font-black tracking-tight text-slate-950">
                    100
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">
                    Mock Questions
                  </div>
                </div>

                <div className="pl-4">
                  <div className="text-2xl font-black tracking-tight text-slate-950">
                    Tutor
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">
                    Study Support
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
              <div className="absolute left-1/2 top-1/2 h-[75%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-200/40 blur-[90px]" />

              <div className="relative">
                <div className="absolute -left-3 top-10 z-20 hidden rounded-2xl border border-white/80 bg-white p-3 shadow-xl shadow-slate-300/30 sm:block">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Practice complete
                      </div>
                      <div className="text-[10px] text-slate-500">
                        8 / 10 correct
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute -right-2 bottom-16 z-20 hidden rounded-2xl border border-white/80 bg-white p-3 shadow-xl shadow-slate-300/30 sm:block">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                      <TrendingUp className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Readiness
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-600">
                        +12% this week
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/80 bg-white/70 p-4 shadow-2xl shadow-indigo-200/30 backdrop-blur-sm sm:p-6">
                  <div className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                          Your preparation
                        </div>
                        <div className="mt-1 text-lg font-black text-slate-900">
                          Keep improving
                        </div>
                      </div>

                      <div className="rounded-xl bg-indigo-50 p-2.5">
                        <Brain className="h-5 w-5 text-indigo-600" />
                      </div>
                    </div>

                    <HeroIllustration className="mx-auto w-full max-w-sm" />

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-100 bg-white p-3">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold">
                            Practice
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          10 Questions
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-white p-3">
                        <div className="flex items-center gap-2 text-slate-400">
                          <BarChart3 className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold">
                            Mastery
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-black text-emerald-600">
                          78%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* University Strip */}
        <div className="border-y border-slate-200/80 bg-white/70">
          <UniversityBadgeStrip />
        </div>

        {/* Curriculum */}
        <section id="courses" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
                  <BookOpen className="h-4 w-4" />
                  Curriculum coverage
                </div>

                <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Your entire CS curriculum,
                  <br className="hidden sm:block" /> structured for the exam.
                </h2>
              </div>

              <p className="max-w-md text-sm leading-6 text-slate-500">
                Move between courses and see the core concepts you should
                expect during your preparation.
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30">
              <div className="border-b border-slate-100 bg-slate-50/70 p-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {COURSE_PREVIEWS.map((course, idx) => {
                    const isActive = selectedCourseIndex === idx

                    return (
                      <button
                        key={course.name}
                        onClick={() => setSelectedCourseIndex(idx)}
                        className={`shrink-0 rounded-xl px-4 py-2.5 text-left transition-all ${
                          isActive
                            ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/10'
                            : 'text-slate-600 hover:bg-white hover:text-slate-950'
                        }`}
                      >
                        <div className="text-xs font-bold">{course.name}</div>
                        <div className="mt-0.5 text-[9px] font-semibold text-slate-400">
                          {course.code}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    <BookOpen className="h-3.5 w-3.5" />
                    Course preview
                  </div>

                  <h3 className="text-2xl font-black tracking-tight text-slate-950">
                    {COURSE_PREVIEWS[selectedCourseIndex].name}
                  </h3>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                    {COURSE_PREVIEWS[selectedCourseIndex].focus}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {COURSE_PREVIEWS[selectedCourseIndex].focus
                      .split(',')
                      .map((item) => (
                        <span
                          key={item}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
                        >
                          {item.trim()}
                        </span>
                      ))}
                  </div>
                </div>

                <button
                  onClick={openPracticeModal}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700"
                >
                  Try sample questions
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-white px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                Built for results
              </div>

              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Everything you need to prepare with confidence.
              </h2>

              <p className="mt-4 text-sm leading-6 text-slate-500 sm:text-base">
                Less guessing about what to study. More focused preparation
                based on your actual performance.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature, idx) => (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-100 hover:shadow-2xl hover:shadow-slate-200/60"
                >
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-indigo-50/50 blur-2xl transition group-hover:bg-indigo-100/60" />

                  <div
                    className={`relative mb-5 flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300 ${accentStyles[feature.accent]}`}
                  >
                    {FEATURE_ICONS[idx]}
                  </div>

                  <div className="relative">
                    <h3 className="text-base font-black text-slate-950">
                      {feature.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                  Simple process
                </div>

                <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Turn preparation into a system.
                </h2>

                <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">
                  Instead of studying everything randomly, ExitAI helps you
                  move from practice to measurable readiness.
                </p>

                <Link
                  to={primaryHref}
                  className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                >
                  Start preparing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="space-y-4">
                {STEPS.map((step) => {
                  const Icon = step.icon

                  return (
                    <div
                      key={step.n}
                      className="group flex gap-5 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-100 hover:shadow-xl hover:shadow-slate-200/40 sm:p-6"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white transition group-hover:bg-indigo-600">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-3">
                          <span className="text-[10px] font-black tracking-widest text-indigo-500">
                            {step.n}
                          </span>

                          <h3 className="font-black text-slate-950">
                            {step.title}
                          </h3>
                        </div>

                        <p className="text-sm leading-6 text-slate-500">
                          {step.description}
                        </p>
                      </div>

                      <ChevronRight className="hidden h-5 w-5 self-center text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500 sm:block" />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Readiness Section */}
        <section className="px-5 py-8 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-12 text-white shadow-2xl shadow-indigo-950/20 sm:px-10 lg:px-14 lg:py-14">
            <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-600/30 blur-3xl" />
            <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-purple-600/20 blur-3xl" />

            <div className="relative z-10 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Course-level analytics
                </div>

                <h2 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                  Know your readiness,
                  <br />
                  not just your score.
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                  A single score doesn't tell you what to study next. ExitAI
                  tracks your mastery across courses so you can identify weak
                  areas before exam day.
                </p>

                <div className="mt-7 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-lg font-black">16</div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Courses
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-lg font-black">78%</div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Example mastery
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-lg font-black text-emerald-400">
                      +12%
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Weekly growth
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-2xl shadow-indigo-900/30 backdrop-blur-sm sm:h-52 sm:w-52">
                <MasteryRing percent={78} size={145} strokeWidth={10} />
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 py-24 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <GraduationCap className="h-6 w-6" />
            </div>

            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Your exam preparation starts here.
            </h2>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">
              Practice smarter, understand your weak areas, and build
              confidence before exam day.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to={primaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>

              <button
                onClick={openPracticeModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg"
              >
                <Play className="h-4 w-4 fill-current" />
                Try sample questions
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Shield className="h-3.5 w-3.5" />
              Free to start. No card required.
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <GraduationCap className="h-4 w-4" />
            </div>

            <div>
              <div className="text-sm font-black text-slate-900">
                ExitAI Ethiopia
              </div>
              <div className="text-[10px] text-slate-400">
                CS exam preparation
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-400">
            <span>Built for BSc Computer Science students</span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
            <Link to="/privacy" className="hover:text-indigo-600 transition-colors">
              Privacy Policy
            </Link>
            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
            <Link to="/terms" className="hover:text-indigo-600 transition-colors">
              Terms of Service
            </Link>
            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
            <span>2026 ExitAI Ethiopia</span>
          </div>
        </div>
      </footer>

      {/* Sample Questions Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false)
            }
          }}
        >
          <div className="relative max-h-[94vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1120] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-400">
                  <BookOpen className="h-3.5 w-3.5" />
                  Interactive practice
                </div>

                <h3 className="mt-1 truncate text-lg font-black sm:text-xl">
                  Sample CS Exit Exam Questions
                </h3>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(94vh-75px)] overflow-y-auto p-5 sm:p-7">
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Choose a question
                  </span>

                  <span className="text-[10px] font-semibold text-slate-500">
                    {Object.keys(userAnswers).length}/{SAMPLE_QUESTIONS.length}{' '}
                    answered
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {SAMPLE_QUESTIONS.map((q, idx) => {
                    const isSelected = activeQuestionId === q.id
                    const hasAnswered = !!userAnswers[q.id]
                    const isCorrect = userAnswers[q.id] === q.correctOption

                    return (
                      <button
                        key={q.id}
                        onClick={() => setActiveQuestionId(q.id)}
                        className={`group rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-950/20'
                            : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                isSelected
                                  ? 'bg-indigo-500 text-white'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {q.icon}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-xs font-bold text-slate-300">
                                {q.course}
                              </div>

                              <div className="mt-0.5 text-[9px] font-semibold text-slate-500">
                                Sample {idx + 1}
                              </div>
                            </div>
                          </div>

                          {hasAnswered &&
                            (isCorrect ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                            ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1.5 text-[10px] font-bold text-indigo-300">
                      {currentQ.course}
                    </span>

                    <span className="text-slate-700">•</span>

                    <span className="text-[10px] font-medium text-slate-500">
                      {currentQ.code}
                    </span>

                    <span className="text-slate-700">•</span>

                    <span className="text-[10px] font-medium text-slate-500">
                      {currentQ.topic}
                    </span>
                  </div>

                  {currentAnswer && (
                    <button
                      onClick={handleResetCurrent}
                      className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 transition hover:text-white"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>

                <div className="p-5 sm:p-7">
                  <div className="mb-6">
                    <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                      Question
                    </div>

                    <p className="text-sm font-semibold leading-7 text-slate-100 sm:text-base">
                      {currentQ.question}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {currentQ.options.map((opt) => {
                      const isSelected = currentAnswer === opt.id
                      const isCorrect = opt.id === currentQ.correctOption

                      let optionStyle =
                        'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800'

                      if (currentAnswer) {
                        if (isCorrect) {
                          optionStyle =
                            'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                        } else if (isSelected && !isCorrect) {
                          optionStyle =
                            'border-rose-500/60 bg-rose-500/10 text-rose-200'
                        } else {
                          optionStyle =
                            'border-slate-800 bg-slate-950/20 text-slate-600 opacity-60'
                        }
                      }

                      return (
                        <button
                          key={opt.id}
                          disabled={!!currentAnswer}
                          onClick={() => handleOptionSelect(opt.id)}
                          className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-xs transition sm:text-sm ${optionStyle}`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[10px] font-black bg-slate-900 text-slate-400 border-slate-700">
                            {opt.id}
                          </span>

                          <span className="flex-1 leading-6">{opt.text}</span>

                          {currentAnswer && isCorrect && (
                            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
                          )}

                          {currentAnswer && isSelected && !isCorrect && (
                            <XCircle className="mt-1 h-4 w-4 shrink-0 text-rose-400" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {!currentAnswer && (
                    <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3.5 py-3 text-[10px] font-medium text-amber-300">
                      <HelpCircle className="h-4 w-4 shrink-0" />
                      Select an answer to see the explanation.
                    </div>
                  )}

                  {currentAnswer && (
                    <div className="mt-7 border-t border-slate-800 pt-6">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                          <Brain className="h-4 w-4" />
                        </div>

                        <div>
                          <div className="text-xs font-black text-white">
                            Explanation
                          </div>

                          <div className="text-[9px] text-slate-500">
                            Understand why the answer is correct
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                        <div className="flex gap-2 text-xs font-bold leading-5 text-amber-300">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                          {currentQ.explanation.coreConcept}
                        </div>

                        <ul className="mt-4 space-y-2">
                          {currentQ.explanation.breakdown.map((item, index) => (
                            <li
                              key={index}
                              className="flex gap-2 text-xs leading-5 text-slate-400"
                            >
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                              {item}
                            </li>
                          ))}
                        </ul>

                        <div className="mt-4 border-t border-indigo-500/10 pt-4 text-[11px] font-medium leading-5 text-emerald-400">
                          <span className="font-black">Exam tip:</span>{' '}
                          {currentQ.explanation.examTip}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-bold text-white">
                    Ready for more?
                  </div>

                  <div className="mt-1 text-[10px] text-slate-500">
                    Practice across all 16 courses.
                  </div>
                </div>

                <Link
                  to={primaryHref}
                  onClick={() => setIsModalOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-indigo-500"
                >
                  Start practicing
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}