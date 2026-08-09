import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle } from 'lucide-react'
import styles from './Auth.module.css'

const DOWNLOADS = [
  {
    href: '/downloads/starter-kit/01_Compliance_Matrix_Template.docx',
    label: 'Compliance Matrix Template',
    desc: 'Map every RFP requirement to your proposal before you submit.',
  },
  {
    href: '/downloads/starter-kit/02_SAM_UEI_Registration_Checklist.docx',
    label: 'SAM.gov & UEI Registration Checklist',
    desc: 'Get registered as a federal contractor, step by step.',
  },
  {
    href: '/downloads/starter-kit/03_DIBBS_DLA_Quick_Start_Guide.docx',
    label: 'DIBBS/DLA Quick-Start Guide',
    desc: 'Start bidding DLA solicitations the right way.',
  },
  {
    href: '/downloads/starter-kit/04_Capability_Statement_Template.docx',
    label: 'Capability Statement Template',
    desc: 'A one-page capability statement, ready to fill in.',
  },
  {
    href: '/downloads/starter-kit/05_GovCon_Accounting_Starter_Sheet.xlsx',
    label: 'GovCon Accounting Starter Sheet',
    desc: 'Track income, expenses, and job costing from day one.',
  },
]

export default function DigestConfirmed() {
  const [params] = useSearchParams()
  const ok = params.get('status') === 'ok'

  return (
    <div className={styles.page}>
      <div className={styles.card} style={{ textAlign: 'center' }}>
        <div className={styles.header}>
          <Link to="/" className={styles.logo}>
            <div className={styles.logoMark}>iQ</div>
            <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
          </Link>
          {ok ? (
            <>
              <CheckCircle size={40} style={{ color: 'var(--gold)', margin: '0 auto var(--sp-4)' }} />
              <h1 className={styles.title}>You're confirmed</h1>
              <p className={styles.sub}>
                Monday's digest of real federal product solicitations is on its way to your inbox each week.
                Unsubscribe anytime with one click from any digest email.
              </p>
            </>
          ) : (
            <>
              <XCircle size={40} style={{ color: 'var(--red)', margin: '0 auto var(--sp-4)' }} />
              <h1 className={styles.title}>That link didn't work</h1>
              <p className={styles.sub}>
                It may have already been used, or it's expired. Head back to the homepage and sign up again.
              </p>
            </>
          )}
        </div>

        {ok && (
          <div style={{ textAlign: 'left', marginTop: 'var(--sp-6, 24px)' }}>
            <p style={{ fontWeight: 600, marginBottom: 'var(--sp-2, 8px)', color: 'var(--navy, #1B2A4A)' }}>
              Your 5 free tools are also here, in case the email is slow to land:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--sp-4, 16px)', display: 'grid', gap: 10 }}>
              {DOWNLOADS.map((d) => (
                <li key={d.href}>
                  
                    href={d.href}
                    style={{ color: 'var(--navy, #1B2A4A)', fontWeight: 500, textDecoration: 'underline' }}
                  >
                    {d.label}
                  </a>
                  <div style={{ fontSize: 13, color: 'var(--text-2, #4A5568)', marginTop: 2 }}>{d.desc}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link to="/" className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
          Back to GovCon Lab
        </Link>
      </div>
    </div>
  )
}