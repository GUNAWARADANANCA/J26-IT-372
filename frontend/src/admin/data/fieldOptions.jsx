import { createContext, useContext, useEffect, useState } from 'react'
import { createFieldOption, getFieldOptions } from './repository'

const FieldOptionsContext = createContext(null)

function mergeOptions(builtIn = [], extras = [], current) {
  const seen = new Set()
  const options = []
  for (const value of [...builtIn, ...extras, current]) {
    const text = String(value ?? '').trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    options.push(text)
  }
  return options
}

export function FieldOptionsProvider({ children }) {
  const [extra, setExtra] = useState({})

  useEffect(() => {
    let cancelled = false
    getFieldOptions()
      .then((data) => {
        if (!cancelled) setExtra(data || {})
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function addOption(field, value) {
    const saved = await createFieldOption(field, value.trim())
    setExtra((prev) => {
      const current = prev[field] || []
      if (current.some((item) => item.toLowerCase() === saved.value.toLowerCase())) {
        return prev
      }
      return {
        ...prev,
        [field]: [...current, saved.value].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: 'base' }),
        ),
      }
    })
    return saved.value
  }

  return (
    <FieldOptionsContext.Provider value={{ extra, addOption, mergeOptions }}>
      {children}
    </FieldOptionsContext.Provider>
  )
}

export function useFieldOptions() {
  const context = useContext(FieldOptionsContext)
  if (!context) {
    throw new Error('useFieldOptions must be used inside FieldOptionsProvider')
  }
  return context
}
