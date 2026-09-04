import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 

  ArrowLeft, 
  ChevronLeft, 
  ChevronRight,
  RotateCcw,
  Shuffle,
  Layers,
  Sparkles,
  Award,
} from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

interface Flashcard {
  id: string
  front: string
  back: string
  exam_weight: string
  module_title: string | null
}

interface CardSRSState {
  state: 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED'
  repetitions: number
  intervalDays: number
  easeFactor: number
  dueDate: string | null
  lastReviewed: string | null
}

interface SRSState {
  [cardId: string]: CardSRSState
}

// Study tips for human touch
const STUDY_TIPS = [
  "Try saying the answer out loud before flipping the card.",
  "Reviewing before bed helps your brain remember better.",
  "Take a short break after every 25 cards.",
  "If you're memorizing the order, hit shuffle.",
  "Write down cards you keep missing. It helps.",
]

export function FlashcardPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  
  const [allFlashcards, setAllFlashcards] = useState<Flashcard[]>([])
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [totalCards, setTotalCards] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
    document.documentElement.classList.contains('dark')
  )
  const [dailyTip, setDailyTip] = useState<string>(STUDY_TIPS[0])
  
  const [srsState, setSrsState] = useState<SRSState>(() => {
    const saved = localStorage.getItem('flashcard_srs_state')
    return saved ? JSON.parse(saved) : {}
  })
  
  const [sessionStats, setSessionStats] = useState({
    reviewed: 0,
    newLearned: 0,
    mastered: 0,
    startTime: Date.now(),
  })

  const [showCompletion, setShowCompletion] = useState(false)

  useEffect(() => {
    fetchFlashcards()
    // Pick a random study tip
    setDailyTip(STUDY_TIPS[Math.floor(Math.random() * STUDY_TIPS.length)])
  }, [courseId])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    localStorage.setItem('flashcard_srs_state', JSON.stringify(srsState))
  }, [srsState])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleFlip()
      }
      if (e.key === '1' && isFlipped) handleAgain()
      if (e.key === '2' && isFlipped) handleHard()
      if (e.key === '3' && isFlipped) handleGood()
      if (e.key === '4' && isFlipped) handleEasy()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFlipped, currentIndex, flashcards, srsState])

  const fetchFlashcards = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}/flashcards`, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Couldn\'t load your flashcards. Tap Retry to try again.')
      const data = await response.json()
      const allCards: Flashcard[] = data.flashcards || []
      setAllFlashcards(allCards)
      
      const dueCards = getDueCards(allCards)
      setFlashcards(dueCards.length > 0 ? dueCards : allCards.slice(0, 10))
      
      setIsPremium(data.is_premium || false)
      setTotalCards(data.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\'t load your flashcards.')
    } finally {
      setLoading(false)
    }
  }

  const getDueCards = (cards: Flashcard[]): Flashcard[] => {
    const now = new Date()
    const dueCards = cards.filter(card => {
      const state = srsState[card.id]
      if (!state || state.state === 'NEW') return true
      if (state.state === 'MASTERED') return false
      if (state.dueDate) {
        return new Date(state.dueDate) <= now
      }
      return true
    })
    return dueCards
  }

  const calculateNextInterval = (state: CardSRSState | undefined, rating: 'again' | 'hard' | 'good' | 'easy'): CardSRSState => {
    const current = state || {
      state: 'NEW' as const,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      dueDate: null,
      lastReviewed: null,
    }

    let { repetitions, intervalDays, easeFactor } = current

    switch (rating) {
      case 'again':
        repetitions = 0
        intervalDays = 0
        easeFactor = Math.max(1.3, easeFactor - 0.2)
        break
      case 'hard':
        repetitions += 1
        intervalDays = Math.max(1, intervalDays * 1.2)
        easeFactor = Math.max(1.3, easeFactor - 0.15)
        break
      case 'good':
        repetitions += 1
        if (repetitions === 1) intervalDays = 1
        else if (repetitions === 2) intervalDays = 3
        else intervalDays = Math.round(intervalDays * easeFactor)
        break
      case 'easy':
        repetitions += 1
        if (repetitions === 1) intervalDays = 3
        else if (repetitions === 2) intervalDays = 7
        else intervalDays = Math.round(intervalDays * easeFactor * 1.3)
        easeFactor = Math.min(3.0, easeFactor + 0.15)
        break
    }

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + intervalDays)

    return {
      state: intervalDays >= 21 ? 'MASTERED' : repetitions > 0 ? 'REVIEW' : 'LEARNING',
      repetitions,
      intervalDays,
      easeFactor,
      dueDate: dueDate.toISOString(),
      lastReviewed: new Date().toISOString(),
    }
  }

  const currentCard = flashcards[currentIndex]

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleAgain = () => {
    if (!currentCard) return
    updateSRS(currentCard.id, 'again')
    nextCard()
  }

  const handleHard = () => {
    if (!currentCard) return
    updateSRS(currentCard.id, 'hard')
    nextCard()
  }

  const handleGood = () => {
    if (!currentCard) return
    updateSRS(currentCard.id, 'good')
    nextCard()
  }

  const handleEasy = () => {
    if (!currentCard) return
    updateSRS(currentCard.id, 'easy')
    nextCard()
  }

  const updateSRS = (cardId: string, rating: 'again' | 'hard' | 'good' | 'easy') => {
    setSrsState(prev => {
      const updatedState = calculateNextInterval(prev[cardId], rating)
      const newState = { ...prev, [cardId]: updatedState }
      
      setSessionStats(prevStats => ({
        ...prevStats,
        reviewed: prevStats.reviewed + 1,
        newLearned: updatedState.state === 'REVIEW' && (!prev[cardId] || prev[cardId].state === 'NEW') ? prevStats.newLearned + 1 : prevStats.newLearned,
        mastered: updatedState.state === 'MASTERED' ? prevStats.mastered + 1 : prevStats.mastered,
      }))
      
      return newState
    })
  }

  const nextCard = () => {
    setIsFlipped(false)
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      const dueCards = getDueCards(allFlashcards)
      if (dueCards.length > 0) {
        setFlashcards(dueCards)
        setCurrentIndex(0)
      } else {
        setShowCompletion(true)
      }
    }
  }

  const prevCard = () => {
    setIsFlipped(false)
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const restartReview = () => {
    setIsFlipped(false)
    setCurrentIndex(0)
    setSrsState({})
    setSessionStats({ reviewed: 0, newLearned: 0, mastered: 0, startTime: Date.now() })
    const firstCards = allFlashcards.slice(0, 10)
    setFlashcards(firstCards)
  }

  const shuffleCards = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  const getWeightLabel = (weight: string) => {
    switch (weight) {
      case 'HIGH': return 'Exam favorite'
      case 'MEDIUM': return 'Likely on exam'
      case 'LOW': return 'Good to know'
      default: return weight
    }
  }

  const getWeightColor = (weight: string) => {
    switch (weight) {
      case 'HIGH': return isDarkMode ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-700 border-red-200'
      case 'MEDIUM': return isDarkMode ? 'bg-amber-900/50 text-amber-300 border-amber-700' : 'bg-amber-100 text-amber-700 border-amber-200'
      case 'LOW': return isDarkMode ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default: return isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'NEW': return 'New'
      case 'LEARNING': return 'Learning'
      case 'REVIEW': return 'Due for review'
      case 'MASTERED': return 'Mastered'
      default: return state
    }
  }

  const srsStats = {
    new: allFlashcards.filter(c => !srsState[c.id] || srsState[c.id].state === 'NEW').length,
    learning: allFlashcards.filter(c => srsState[c.id]?.state === 'LEARNING').length,
    review: allFlashcards.filter(c => srsState[c.id]?.state === 'REVIEW').length,
    mastered: allFlashcards.filter(c => srsState[c.id]?.state === 'MASTERED').length,
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-slate-500">Getting your cards ready...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button onClick={fetchFlashcards} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl">Try Again</button>
        </div>
      </div>
    )
  }

  if (flashcards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-indigo-100 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center mb-4">
            <Layers className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nothing to review right now</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Come back tomorrow for a quick review. You're all caught up!</p>
          <button onClick={restartReview} className="px-5 py-2.5 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-500 transition-colors">Start Fresh</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen py-8 px-4 transition-colors active:scale-95 ${isDarkMode ? 'bg-slate-950' : 'bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50'}`}>
      <div className="max-w-2xl mx-auto">
        {/* Premium Banner */}
        {!isPremium && totalCards > flashcards.length && (
          <div className={`mb-4 p-4 rounded-2xl border text-center ${isDarkMode ? 'bg-amber-950/30 border-amber-800' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-sm font-semibold ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
              You're seeing {allFlashcards.length} of {totalCards} cards. Upgrade for the full set.
            </p>
            <button onClick={() => navigate('/pricing')} className="mt-2 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-500 transition-colors">
              See All Cards
            </button>
          </div>
        )}

        {/* Study Tip */}
        <div className={`mb-4 px-4 py-3 rounded-2xl text-xs flex items-start gap-2 ${isDarkMode ? 'bg-indigo-950/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{dailyTip}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className={`flex items-center text-sm font-semibold transition-colors active:scale-95 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-indigo-600'}`}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </button>
          
          <div className="flex items-center gap-2">
            <button onClick={shuffleCards} className={`p-2 rounded-xl border transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600'}`} title="Shuffle cards">
              <Shuffle className="w-4 h-4" />
            </button>
            
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-200'}`}>
              {flashcards.length} cards to review
            </span>
          </div>
        </div>

        {/* Progress Overview */}
        <div className={`mb-6 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="text-center">
              <div className={`text-lg font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{srsStats.new}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">New</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>{srsStats.learning}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Learning</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{srsStats.review}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Review</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{srsStats.mastered}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mastered</div>
            </div>
          </div>

          <div className={`h-2 rounded-full overflow-hidden flex ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {srsStats.new > 0 && <div className="h-full bg-blue-500" style={{ width: (srsStats.new / allFlashcards.length) * 100 + '%' }} />}
            {srsStats.learning > 0 && <div className="h-full bg-amber-500" style={{ width: (srsStats.learning / allFlashcards.length) * 100 + '%' }} />}
            {srsStats.review > 0 && <div className="h-full bg-purple-500" style={{ width: (srsStats.review / allFlashcards.length) * 100 + '%' }} />}
            {srsStats.mastered > 0 && <div className="h-full bg-emerald-500" style={{ width: (srsStats.mastered / allFlashcards.length) * 100 + '%' }} />}
          </div>

          <div className="flex justify-between mt-3 text-[10px] font-semibold">
            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Card {currentIndex + 1} of {flashcards.length}</span>
            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Tap card or press Space to flip</span>
          </div>
        </div>

        {/* Flashcard */}
        {currentCard && (
          <div>
            <div 
              onClick={handleFlip}
              className={`relative cursor-pointer rounded-3xl shadow-xl border p-8 min-h-[320px] flex flex-col items-center justify-center text-center transition-all active:scale-95 duration-300 hover:shadow-2xl ${
                isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200'
              }`}
            >
              <span className={`absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getWeightColor(currentCard.exam_weight)}`}>
                {getWeightLabel(currentCard.exam_weight)}
              </span>

              {currentCard.module_title && (
                <span className={`absolute top-4 left-4 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  {currentCard.module_title}
                </span>
              )}

              {srsState[currentCard.id] && srsState[currentCard.id].state !== 'NEW' && (
                <span className={`absolute bottom-4 left-4 px-2 py-1 rounded-md text-[9px] font-bold ${srsState[currentCard.id].state === 'MASTERED' ? 'bg-emerald-100 text-emerald-700' : srsState[currentCard.id].state === 'REVIEW' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                  {getStateLabel(srsState[currentCard.id].state)}
                </span>
              )}

              <div className={`transition-all active:scale-95 duration-300 transform ${isFlipped ? 'scale-95' : 'scale-100'}`}>
                {!isFlipped ? (
                  <div>
                    <p className={`text-2xl font-bold leading-relaxed ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {currentCard.front}
                    </p>
                    <p className={`text-xs mt-6 flex items-center justify-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Sparkles className="w-3 h-3" /> Tap to see the answer
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className={`text-lg leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                      {currentCard.back}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rating Buttons - Human labels */}
            {isFlipped && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
                <button onClick={handleAgain} className={`flex flex-col items-center gap-1 px-3 py-3 rounded-2xl font-semibold transition-all active:scale-95 hover:scale-105 ${isDarkMode ? 'bg-red-950/50 border border-red-800 text-red-300 hover:bg-red-950/70' : 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'}`}>
                  <span className="text-sm font-bold">Didn't get it</span>
                  <span className="text-[9px] opacity-70">See again soon</span>
                </button>
                <button onClick={handleHard} className={`flex flex-col items-center gap-1 px-3 py-3 rounded-2xl font-semibold transition-all active:scale-95 hover:scale-105 ${isDarkMode ? 'bg-amber-950/50 border border-amber-800 text-amber-300 hover:bg-amber-950/70' : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
                  <span className="text-sm font-bold">Almost there</span>
                  <span className="text-[9px] opacity-70">1 day</span>
                </button>
                <button onClick={handleGood} className={`flex flex-col items-center gap-1 px-3 py-3 rounded-2xl font-semibold transition-all active:scale-95 hover:scale-105 ${isDarkMode ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300 hover:bg-emerald-950/70' : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}>
                  <span className="text-sm font-bold">Got it</span>
                  <span className="text-[9px] opacity-70">3 days</span>
                </button>
                <button onClick={handleEasy} className={`flex flex-col items-center gap-1 px-3 py-3 rounded-2xl font-semibold transition-all active:scale-95 hover:scale-105 ${isDarkMode ? 'bg-blue-950/50 border border-blue-800 text-blue-300 hover:bg-blue-950/70' : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
                  <span className="text-sm font-bold">Too easy!</span>
                  <span className="text-[9px] opacity-70">7 days</span>
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button onClick={prevCard} disabled={currentIndex === 0} className={`p-2.5 rounded-xl border transition-all active:scale-95 disabled:opacity-30 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={restartReview} className={`flex items-center gap-1.5 text-sm font-medium transition-colors active:scale-95 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-indigo-600'}`}>
                <RotateCcw className="w-3.5 h-3.5" /> Start over
              </button>
              <button onClick={nextCard} disabled={currentIndex === flashcards.length - 1} className={`p-2.5 rounded-xl border transition-all active:scale-95 disabled:opacity-30 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Keyboard Hints */}
            <div className={`flex items-center justify-center gap-3 mt-4 text-[10px] ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">Space</kbd> Flip</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">1-4</kbd> Rate</span>
            </div>
          </div>
        )}
      </div>

      {/* Completion Modal */}
      {showCompletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className={`rounded-3xl max-w-md w-full p-8 text-center shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center mb-4">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Nice work!
            </h2>
            <p className={`text-sm mb-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              You reviewed {sessionStats.reviewed} cards today.
            </p>
            
            <div className={`space-y-3 mb-6 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <div className="flex justify-between text-sm">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Cards reviewed</span>
                <span className="font-bold">{sessionStats.reviewed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>New cards learned</span>
                <span className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{sessionStats.newLearned}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Mastered</span>
                <span className={`font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{sessionStats.mastered}</span>
              </div>
            </div>

            <button onClick={() => setShowCompletion(false)} className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-colors">
              Keep going
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FlashcardPage