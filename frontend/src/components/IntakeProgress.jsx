import Icon from './icons.jsx'

// The five stages of a registration: [icon, title, what the officer does, section id in the wizard].
// eslint-disable-next-line react-refresh/only-export-components
export const INTAKE_STEPS = [
  ['camera', 'Capture envelope', 'Photo from the scale camera, a webcam or a file', 'step-image'],
  ['edit', 'Check addresses', 'Compare the suggested fields with the envelope', 'step-address'],
  ['check', 'Confirm details', 'Choose the destination office and confirm', 'step-confirm'],
  ['scale', 'Weigh', 'Use the stable reading from the IoT scale', 'step-weight'],
  ['printer', 'Charge & print', 'Take payment, accept and print the label', 'step-payment'],
]

// Which stages are finished. Manual entry (B0) needs no photo. The last stage ends by leaving the draft.
// eslint-disable-next-line react-refresh/only-export-components
export function intakeProgress(draft, recipient = draft.recipient || {}, config = draft.experiment_config) {
  return [
    Boolean(draft.current_image_id) || config === 'B0',
    Boolean(recipient.name && (recipient.city || recipient.postcode)),
    Boolean(draft.fields_confirmed_at),
    Boolean(draft.weight),
    false,
  ]
}

// Horizontal stepper for the wizard: each stage links to its section.
export function IntakeStepper({ progress }) {
  const current = progress.findIndex((ok) => !ok)
  return (
    <nav aria-label="Registration steps" className="rounded-lg border border-line bg-white px-3 py-3 sm:px-5">
      <ol className="grid grid-cols-5 gap-1">
        {INTAKE_STEPS.map(([icon, title, , anchor], i) => {
          const done = progress[i]
          const isCurrent = i === current
          return (
            <li key={title} className="relative">
              {i > 0 && <span aria-hidden className={`absolute right-1/2 top-4 h-0.5 w-full ${progress[i - 1] ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
              <a href={`#${anchor}`} aria-current={isCurrent ? 'step' : undefined}
                className="relative flex flex-col items-center gap-1.5 rounded-md px-1 py-0.5 text-center hover:bg-brand-50/70">
                <span className={`grid h-8 w-8 place-items-center rounded-full ${done
                  ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-brand-700 text-white ring-4 ring-brand-100' : 'bg-white text-slate-400 ring-1 ring-slate-300'}`}>
                  {done ? <Icon name="tick" className="h-4 w-4" /> : <Icon name={icon} className="h-4 w-4" />}
                </span>
                <span className={`text-[11px] leading-tight sm:text-xs ${isCurrent ? 'font-semibold text-brand-900' : done ? 'text-slate-700' : 'text-slate-500'}`}>
                  <span className="hidden sm:inline">{i + 1}. </span>{title}
                </span>
                <span className="sr-only">{done ? 'complete' : isCurrent ? 'current step' : 'not started'}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
