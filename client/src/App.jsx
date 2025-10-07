import { useEffect, useMemo, useState } from 'react'

const API_BASE = 'http://localhost:4000'

const initial = {
  scenario_name: '',
  monthly_invoice_volume: '',
  num_ap_staff: '',
  avg_hours_per_invoice: '',
  hourly_wage: '',
  error_rate_manual: '',
  error_cost: '',
  time_horizon_months: '',
  one_time_implementation_cost: '',
}

export default function App() {
  const [inputs, setInputs] = useState(initial)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [scenarios, setScenarios] = useState([])
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')

  const refreshAll = async () => {
    setInputs({
      scenario_name: '',
      monthly_invoice_volume: '',
      num_ap_staff: '',
      avg_hours_per_invoice: '',
      hourly_wage: '',
      error_rate_manual: '',
      error_cost: '',
      time_horizon_months: '',
      one_time_implementation_cost: '',
    })
    setResults(null)
    await loadScenarios()
  }

  const formatted = useMemo(() => {
    if (!results) return null
    const nf = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    const n = v => v.toLocaleString('en-US', { maximumFractionDigits: 2 })
    return {
      monthly_savings: nf.format(results.monthly_savings),
      payback_months: n(results.payback_months),
      roi_percentage: `${n(results.roi_percentage)}%`,
      cumulative_savings: nf.format(results.cumulative_savings),
    }
  }, [results])

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      // Only simulate when required numeric fields are entered
      const {
        monthly_invoice_volume,
        num_ap_staff,
        avg_hours_per_invoice,
        hourly_wage,
        error_rate_manual,
        error_cost,
        time_horizon_months,
      } = inputs
      const required = [
        monthly_invoice_volume,
        num_ap_staff,
        avg_hours_per_invoice,
        hourly_wage,
        error_rate_manual,
        error_cost,
        time_horizon_months,
      ]
      const allSet = required.every(v => v !== '' && v !== null && v !== undefined)
      if (!allSet) {
        setResults(null)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...inputs,
            monthly_invoice_volume: Number(inputs.monthly_invoice_volume),
            num_ap_staff: Number(inputs.num_ap_staff),
            avg_hours_per_invoice: Number(inputs.avg_hours_per_invoice),
            hourly_wage: Number(inputs.hourly_wage),
            error_rate_manual: Number(inputs.error_rate_manual),
            error_cost: Number(inputs.error_cost),
            time_horizon_months: Number(inputs.time_horizon_months),
            one_time_implementation_cost: inputs.one_time_implementation_cost === '' ? 0 : Number(inputs.one_time_implementation_cost),
          }),
          signal: controller.signal,
        })
        const data = await res.json()
        setResults(data)
      } catch (e) {
        // ignore for prototype
      } finally {
        setLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [inputs])

  const handleChange = e => {
    const { name, value } = e.target
    setInputs(prev => ({ ...prev, [name]: name === 'scenario_name' ? value : value }))
  }

  const toNumericPayload = (src) => ({
    monthly_invoice_volume: Number(src.monthly_invoice_volume),
    num_ap_staff: Number(src.num_ap_staff),
    avg_hours_per_invoice: Number(src.avg_hours_per_invoice),
    hourly_wage: Number(src.hourly_wage),
    error_rate_manual: Number(src.error_rate_manual),
    error_cost: Number(src.error_cost),
    time_horizon_months: Number(src.time_horizon_months),
    one_time_implementation_cost: src.one_time_implementation_cost === '' ? 0 : Number(src.one_time_implementation_cost),
  })

  const saveScenario = async () => {
    if (!inputs.scenario_name || inputs.scenario_name.trim() === '') {
      alert('Please enter a Scenario Name before saving.')
      return
    }
    const { scenario_name } = inputs
    const payload = toNumericPayload(inputs)
    const res = await fetch(`${API_BASE}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_name, ...payload }),
    })
    if (res.ok) {
      await loadScenarios()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Failed to save scenario')
    }
  }

  const downloadBase64 = (base64, filename, mime = 'application/octet-stream') => {
    const link = document.createElement('a')
    link.href = `data:${mime};base64,${base64}`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const openReport = () => setShowEmail(true)
  const closeReport = () => setShowEmail(false)
  const submitReport = async () => {
    if (!email) return alert('Please enter your email')
    const payload = {
      email,
      inputs: {
        monthly_invoice_volume: Number(inputs.monthly_invoice_volume),
        num_ap_staff: Number(inputs.num_ap_staff),
        avg_hours_per_invoice: Number(inputs.avg_hours_per_invoice),
        hourly_wage: Number(inputs.hourly_wage),
        error_rate_manual: Number(inputs.error_rate_manual),
        error_cost: Number(inputs.error_cost),
        time_horizon_months: Number(inputs.time_horizon_months),
        one_time_implementation_cost: inputs.one_time_implementation_cost === '' ? 0 : Number(inputs.one_time_implementation_cost),
      }
    }
    const res = await fetch(`${API_BASE}/report/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok && data?.base64) {
      downloadBase64(data.base64, data.filename || 'roi_report.pdf', data.mime || 'application/pdf')
      setShowEmail(false)
    } else {
      alert(data?.error || 'Failed to generate report')
    }
  }

  const loadScenarios = async () => {
    const res = await fetch(`${API_BASE}/scenarios`)
    if (res.ok) {
      const data = await res.json()
      setScenarios(data)
    }
  }

  useEffect(() => {
    loadScenarios()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Invoicing ROI Simulator</h1>
          <div className="flex gap-2">
            <button
              onClick={saveScenario}
              disabled={!inputs.scenario_name || inputs.scenario_name.trim() === ''}
              className={`px-3 py-2 rounded ${(!inputs.scenario_name || inputs.scenario_name.trim() === '') ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 text-white'}`}
            >
              Save Scenario
            </button>
            <button onClick={openReport} className="px-3 py-2 border rounded">Download Report</button>
            <button onClick={refreshAll} className="px-3 py-2 border rounded">Refresh</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-4 rounded shadow">
          <h2 className="font-medium mb-3">Inputs</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['scenario_name', 'Scenario Name', 'text', 'e.g., Q4_Pilot'],
              ['monthly_invoice_volume', 'Monthly Invoice Volume', 'number', 'e.g., 2000'],
              ['num_ap_staff', 'AP Staff', 'number', 'e.g., 3'],
              ['avg_hours_per_invoice', 'Hours per Invoice', 'number', 'e.g., 0.17'],
              ['hourly_wage', 'Hourly Wage ($)', 'number', 'e.g., 30'],
              ['error_rate_manual', 'Manual Error Rate (%)', 'number', 'e.g., 0.5'],
              ['error_cost', 'Error Cost ($)', 'number', 'e.g., 100'],
              ['time_horizon_months', 'Time Horizon (months)', 'number', 'e.g., 36'],
              ['one_time_implementation_cost', 'One-time Implementation ($)', 'number', 'optional'],
            ].map(([name, label, type]) => (
              <label key={name} className="flex flex-col text-sm">
                <span className="mb-1 text-slate-700">{label}</span>
                <input
                  className="border rounded px-3 py-2"
                  name={name}
                  type={type}
                  value={inputs[name]}
                  onChange={handleChange}
                  placeholder={arguments[0]?.[3]}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white p-4 rounded shadow">
          <h2 className="font-medium mb-3">Results</h2>
          {!results && <div className="text-slate-500">Enter inputs to see results…</div>}
          {results && (
            <div className="space-y-3">
              <Metric label="Monthly Savings" value={formatted?.monthly_savings || '-'} loading={loading} />
              <Metric label="Payback (months)" value={formatted?.payback_months || '-'} loading={loading} />
              <Metric label="ROI (horizon)" value={formatted?.roi_percentage || '-'} loading={loading} />
              <Metric label="Cumulative Savings" value={formatted?.cumulative_savings || '-'} loading={loading} />
            </div>
          )}
        </section>

        <section className="md:col-span-2 bg-white p-4 rounded shadow">
          <h2 className="font-medium mb-3">Saved Scenarios</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Monthly Savings</th>
                  <th className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map(s => (
                  <tr key={s._id} className="border-t">
                    <td className="py-2 pr-4">{s.scenarioName}</td>
                    <td className="py-2 pr-4">${s.results?.monthly_savings?.toLocaleString?.()}</td>
                    <td className="py-2 pr-4">{new Date(s.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showEmail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow w-full max-w-sm">
            <h3 className="font-medium mb-2">Email to receive report</h3>
            <input
              className="border rounded px-3 py-2 w-full mb-3"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
            />
            <div className="flex justify-end gap-2">
              <button onClick={closeReport} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={submitReport} className="px-3 py-2 bg-indigo-600 text-white rounded">Generate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, loading }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{loading ? '…' : value}</span>
    </div>
  )
}


