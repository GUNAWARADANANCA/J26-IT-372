import { useEffect, useRef, useState } from 'react'
import { getPowerBiEmbed, getPowerBiStatus } from '../data/repository'
import ChartCard from './ChartCard'

export default function PowerBiPanel({ page }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const frame = useRef(null)

  useEffect(() => {
    let cancelled = false
    getPowerBiStatus()
      .then((payload) => {
        if (!cancelled) setStatus(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Power BI status could not be loaded')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!status?.reports_configured?.[page] || !frame.current) return undefined
    let cancelled = false
    let embedded
    getPowerBiEmbed(page)
      .then(async (config) => {
        const powerbi = await import('powerbi-client')
        if (cancelled || !frame.current) return
        const service = new powerbi.service.Service(
          powerbi.factories.hpmFactory,
          powerbi.factories.wpmpFactory,
          powerbi.factories.routerFactory,
        )
        embedded = service.embed(frame.current, {
          type: 'report',
          id: config.reportId,
          embedUrl: config.embedUrl,
          accessToken: config.accessToken,
          tokenType: powerbi.models.TokenType.Embed,
        })
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Power BI report did not load')
      })
    return () => {
      cancelled = true
      if (embedded && frame.current) {
        embedded.off?.('error')
        try {
          embedded.service?.reset?.(frame.current)
        } catch {
          /* The frame may already be gone. */
        }
      }
    }
  }, [page, status])

  return (
    <ChartCard title="Power BI" note="Native charts above stay available. This panel embeds a report only when the workspace is configured.">
      {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
      {!status ? <p className="text-sm text-slate-500">Checking Power BI configuration.</p> : null}
      {status && !status.reports_configured?.[page] ? (
        <div className="text-sm text-slate-700">
          <p>Power BI is not configured. Missing settings: {status.missing.join(', ') || 'none'}.</p>
          <p className="mt-2">Report ids not set: {Object.entries({
            productivity: 'POWERBI_REPORT_PRODUCTIVITY',
            'forecast-monitoring': 'POWERBI_REPORT_FORECAST_MONITORING',
            'kpi-simulator': 'POWERBI_REPORT_KPI_SIMULATOR',
            'kpi-forecasts': 'POWERBI_REPORT_KPI_FORECASTS',
            'postal-kpi-dashboard': 'POWERBI_REPORT_POSTAL_KPI_DASHBOARD',
          }).filter(([name]) => !status.reports_configured[name]).map(([, name]) => name).join(', ') || 'none'}.</p>
          <p className="mt-2">{status.refresh}</p>
          <p className="mt-2">{status.note}</p>
        </div>
      ) : null}
      {status?.reports_configured?.[page] ? <div ref={frame} className="h-96 w-full" title="Power BI report" /> : null}
    </ChartCard>
  )
}
