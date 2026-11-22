interface StartupErrorProps {
  title: string
  detail: string
}

/** Shown when the desktop shell cannot be initialized. */
export default function StartupError({ title, detail }: StartupErrorProps): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-paper p-8 text-ink">
      <div className="max-w-md rounded-lg border border-line bg-paper p-6 shadow-sm">
        <h1 className="mb-2 text-lg font-semibold text-accent">{title}</h1>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{detail}</p>
      </div>
    </div>
  )
}
