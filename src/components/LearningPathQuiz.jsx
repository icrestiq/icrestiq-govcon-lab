import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, ArrowRight, RotateCcw } from 'lucide-react'
import styles from './LearningPathQuiz.module.css'

// Four questions, each answer tagged to one of three experience tiers.
// Tallied at the end — most answers in one tier wins; a tie falls back to
// STARTING (the middle tier), same tie-break pattern as the /go quiz.
const QUESTIONS = [
  {
    prompt: 'Where are you in your government contracting journey?',
    answers: [
      { label: "Still researching — I haven't registered in SAM.gov yet", tier: 'EXPLORING' },
      { label: "Registered and getting set up, but haven't won a contract yet", tier: 'STARTING' },
      { label: "I've won a few contracts and I'm working out the kinks", tier: 'STARTING' },
      { label: "Winning regularly — I'm focused on scaling now", tier: 'SEASONED' },
    ],
  },
  {
    prompt: 'How comfortable are you sourcing and pricing an item once you find a solicitation?',
    answers: [
      { label: "Honestly, still learning what NSN/PSC/FSC codes even mean", tier: 'EXPLORING' },
      { label: "I can find the item, but pricing it competitively is mostly guesswork", tier: 'STARTING' },
      { label: "I have a repeatable sourcing and pricing process", tier: 'SEASONED' },
    ],
  },
  {
    prompt: 'How are you tracking bids, deadlines, and compliance requirements right now?',
    answers: [
      { label: "I'm not really tracking anything yet", tier: 'EXPLORING' },
      { label: "Spreadsheets and sticky notes — it works, barely", tier: 'STARTING' },
      { label: "I've got a system dialed in", tier: 'SEASONED' },
    ],
  },
  {
    prompt: "What's the biggest thing standing between you and your next contract?",
    answers: [
      { label: "Understanding how any of this actually works", tier: 'EXPLORING' },
      { label: "Finding opportunities that fit and pricing them right", tier: 'STARTING' },
      { label: "Scaling without dropping the ball on compliance or subs", tier: 'SEASONED' },
    ],
  },
]

// Hand-picked, not AI-generated — matching a member to the right resource
// for their actual experience level is a judgment call worth making once,
// well, rather than re-deriving it per quiz-taker. Update this list
// directly when the catalog changes; it doesn't read from the products
// table live like Suggested Bid's recommendations do.
const RESULTS = {
  EXPLORING: {
    title: "You're just getting started — and that's exactly where you should be.",
    blurb: "Before spending a dollar on tools, get the fundamentals down. This free course covers everything from LLC formation to your first SAM.gov registration.",
    items: [
      {
        label: 'Free Course — GovCon Mastery',
        desc: '23 free lessons covering the fundamentals, start to finish.',
        href: 'https://class.govconlab.com',
        external: true,
      },
      {
        label: 'GovCon Lab Membership',
        desc: 'Community, weekly intel, and real savings once you want more support.',
        href: '/store/lab-monthly',
      },
      {
        label: 'GovCon BookKeeping Suite',
        desc: 'Chart of accounts, P&L, and a live KPI dashboard built for GovCon — worth setting up before your first award, not after.',
        href: '/store/cb16b0bd-59df-4468-a3dd-e86a38724874',
      },
    ],
  },
  STARTING: {
    title: "You're in it now — time to build real systems.",
    blurb: "You know the basics. The next unlock is writing proposals that actually win, and going deep on a niche you can own.",
    items: [
      {
        label: 'Proposal Builder Playbook',
        desc: 'Section-by-section guide to a winning proposal, plus a pre-submission checklist.',
        href: '/store/2601a099-47c5-46e4-9fe6-399b22eb3a42',
      },
      {
        label: 'GovCon Lab Pro Membership',
        desc: 'Live Q&A, priority support, and 25% off every digital product from here on.',
        href: '/store/lab-pro-monthly',
      },
      {
        label: 'Browse the niche playbooks',
        desc: 'Nine industry-specific playbooks — exact FSC/PSC codes and sourcing strategy for your product category.',
        href: '/store',
      },
      {
        label: 'GovCon BookKeeping Suite',
        desc: 'Chart of accounts, P&L, and a live KPI dashboard built for GovCon.',
        href: '/store/cb16b0bd-59df-4468-a3dd-e86a38724874',
      },
    ],
  },
  SEASONED: {
    title: "You're winning — now it's about scaling without breaking anything.",
    blurb: "At this stage the risk isn't finding opportunities, it's compliance gaps and outgrowing your own back office.",
    items: [
      {
        label: 'The Subcontractor Playbook',
        desc: 'Qualify and use subs to win beyond your current in-house capability.',
        href: '/store/1415ba3c-7e8b-4668-9c6f-a719d95206ab',
      },
      {
        label: 'GovCon BookKeeping Suite',
        desc: 'Chart of accounts, P&L, and a live KPI dashboard built for GovCon.',
        href: '/store/cb16b0bd-59df-4468-a3dd-e86a38724874',
      },
      {
        label: 'MIL-SPEC Packaging Field Guide',
        desc: 'Every MIL-SPEC standard and marking requirement, so a packaging rejection never costs you a contract.',
        href: '/store/228fd020-76fb-474e-aeda-e808a53849ed',
      },
    ],
  },
}

function computeTier(answers) {
  const counts = { EXPLORING: 0, STARTING: 0, SEASONED: 0 }
  answers.forEach((tier) => { counts[tier] = (counts[tier] || 0) + 1 })
  const max = Math.max(counts.EXPLORING, counts.STARTING, counts.SEASONED)
  const top = Object.keys(counts).filter((k) => counts[k] === max)
  return top.length === 1 ? top[0] : 'STARTING'
}

export default function LearningPathQuiz() {
  const [step, setStep] = useState(0) // 0 = intro, 1..N = questions, N+1 = result
  const [answers, setAnswers] = useState([])

  const totalQuestions = QUESTIONS.length
  const isResult = step === totalQuestions + 1
  const isIntro = step === 0

  function start() {
    setAnswers([])
    setStep(1)
  }

  function pick(tier) {
    const next = [...answers, tier]
    setAnswers(next)
    setStep(step + 1)
  }

  function retake() {
    setAnswers([])
    setStep(0)
  }

  const result = isResult ? RESULTS[computeTier(answers)] : null

  return (
    <div className={styles.card}>
      {isIntro && (
        <div className={styles.intro}>
          <div className={styles.iconBadge}><Compass size={20} /></div>
          <h3 className={styles.introTitle}>Take the quiz to put you on the right learning path</h3>
          <p className={styles.introText}>
            Four quick questions about where you are in your GovCon journey — we'll point you to the free course, playbooks, or tools that actually fit your stage.
          </p>
          <button type="button" className="btn btn-primary" onClick={start}>
            Start the quiz <ArrowRight size={16} />
          </button>
        </div>
      )}

      {!isIntro && !isResult && (
        <div className={styles.question}>
          <div className={styles.progress}>
            {QUESTIONS.map((_, i) => (
              <span key={i} className={`${styles.dot} ${i < step ? styles.dotDone : ''} ${i === step - 1 ? styles.dotActive : ''}`} />
            ))}
          </div>
          <p className={styles.progressLabel}>Question {step} of {totalQuestions}</p>
          <h3 className={styles.prompt}>{QUESTIONS[step - 1].prompt}</h3>
          <div className={styles.answers}>
            {QUESTIONS[step - 1].answers.map((a) => (
              <button key={a.label} type="button" className={styles.answerBtn} onClick={() => pick(a.tier)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isResult && result && (
        <div className={styles.result}>
          <h3 className={styles.resultTitle}>{result.title}</h3>
          <p className={styles.resultBlurb}>{result.blurb}</p>
          <div className={styles.resultItems}>
            {result.items.map((item) => {
              const inner = (
                <>
                  <div className={styles.resultItemLabel}>{item.label}</div>
                  <div className={styles.resultItemDesc}>{item.desc}</div>
                </>
              )
              return item.external ? (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={`card card-hover ${styles.resultItem}`}>
                  {inner}
                </a>
              ) : (
                <Link key={item.label} to={item.href} className={`card card-hover ${styles.resultItem}`}>
                  {inner}
                </Link>
              )
            })}
          </div>
          <button type="button" className="btn btn-ghost" onClick={retake}>
            <RotateCcw size={14} /> Retake the quiz
          </button>
        </div>
      )}
    </div>
  )
}
