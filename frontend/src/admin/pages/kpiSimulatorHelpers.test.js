import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatChangeBadge,
  formatSignedHours,
  formatSignedPercent,
  SCENARIO_PRESETS,
  validateSimulationParameters,
} from './kpiSimulatorHelpers.js'

describe('kpiSimulatorHelpers', () => {
  it('formats signed percent correctly', () => {
    assert.equal(formatSignedPercent(20), '+20%')
    assert.equal(formatSignedPercent(-10), '-10%')
    assert.equal(formatSignedPercent(0), '0%')
  })

  it('formats signed hours correctly', () => {
    assert.equal(formatSignedHours(5), '+5 hours')
    assert.equal(formatSignedHours(0), '0 hours')
  })

  it('formats change badges with positive, negative, and neutral styles', () => {
    const pos = formatChangeBadge(1.3)
    assert.equal(pos.text, '+1.3%')
    assert.equal(pos.direction, 'positive')

    const neg = formatChangeBadge(-2.1)
    assert.equal(neg.text, '-2.1%')
    assert.equal(neg.direction, 'negative')

    const zero = formatChangeBadge(0)
    assert.equal(zero.text, '0.0%')
    assert.equal(zero.direction, 'neutral')
  })

  it('validates simulation parameters rigorously', () => {
    const invalidEmpty = validateSimulationParameters({
      employeeId: '',
      workloadAdj: 20,
      extraHours: 5,
      absenceRate: 0,
    })
    assert.equal(invalidEmpty.isValid, false)
    assert.equal(invalidEmpty.errors.length, 1)

    const invalidRange = validateSimulationParameters({
      employeeId: 'EMP1137',
      workloadAdj: 80,
      extraHours: 35,
      absenceRate: 70,
    })
    assert.equal(invalidRange.isValid, false)
    assert.equal(invalidRange.errors.length, 3)

    const valid = validateSimulationParameters({
      employeeId: 'EMP1137',
      workloadAdj: 20,
      extraHours: 5,
      absenceRate: 0,
    })
    assert.equal(valid.isValid, true)
    assert.equal(valid.errors.length, 0)
  })

  it('provides all 9 required scenario presets', () => {
    assert.equal(SCENARIO_PRESETS.length >= 9, true)
    const labels = SCENARIO_PRESETS.map((s) => s.label)
    assert.ok(labels.includes('Increase Workload by 20%'))
    assert.ok(labels.includes('Improve Productivity by 5%'))
    assert.ok(labels.includes('Increase Working Hours'))
    assert.ok(labels.includes('Custom Scenario'))
  })
})
