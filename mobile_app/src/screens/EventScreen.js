import * as Crypto from 'expo-crypto'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { request } from '../api'
import { Btn, Pill, SignaturePad, colors, styles } from '../components'
import { enqueue } from '../db'
import { captureFix } from '../location'
import { syncNow } from '../sync'

const ATTEMPT_REASONS = ['Recipient not available', 'Premises closed', 'Address not found', 'Recipient refused', 'Unsafe access']

export default function EventScreen({ session, trackingId, onDone }) {
  const [info, setInfo] = useState(null)
  const [offline, setOffline] = useState(false)
  const [status, setStatus] = useState('')
  const [ackType, setAckType] = useState('signature')
  const [recipientName, setRecipientName] = useState('')
  const [reference, setReference] = useState('')
  const [signature, setSignature] = useState('')
  const [reason, setReason] = useState('')
  const [exception, setException] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    request(session, `/api/scans/lookup/${encodeURIComponent(trackingId)}`, { timeoutMs: 6000 })
      .then((i) => { setInfo(i); setStatus(i.allowed_statuses[0]?.status || '') })
      .catch((e) => {
        if (e.status === 404 || e.status === 403) setError(e.message)
        else { setOffline(true); setStatus(session.user.statuses?.[0]?.status || '') }
      })
  }, [session, trackingId])

  const options = info ? info.allowed_statuses : (session.user.statuses || [])
  const needsAck = status === 'delivered'
  const needsReason = status === 'delivery_attempted' || status === 'return_started'
  const ackReady = !needsAck || exception.trim().length >= 5 || (ackType === 'signature' ? signature && recipientName : ackType === 'recipient_name' ? recipientName : reference)

  async function save() {
    setBusy(true)
    setError('')
    try {
      const location = await captureFix()
      const event = {
        event_id: Crypto.randomUUID(),
        item_id: info?.tracking_id || trackingId,
        requested_status: status,
        captured_at: new Date().toISOString(),
        expected_revision: info?.revision ?? null,
        device_id: 'android-field-app',
        client_version: 'field-1.0',
        offline,
        location,
        reason: needsReason ? reason : '',
        exception_reason: needsAck ? exception : '',
        acknowledgement: needsAck && !exception ? {
          type: ackType, recipient_name: recipientName, reference, signature_svg: ackType === 'signature' ? signature : '',
        } : undefined,
      }
      await enqueue(event)              // durable first (survives app restart)
      const summary = await syncNow(session)
      setResult({ event, summary, location })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const s = result.summary
    const text = s.failed ? 'Saved on this phone. It will upload automatically when the network returns.'
      : s.accepted ? 'Accepted by the server.' : s.held ? 'Saved, but held for postmaster review (see reason on the home screen).'
        : s.rejected ? 'The server rejected this scan (see reason on the home screen).' : 'Already recorded.'
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.h2}>{result.event.item_id}</Text>
          <Text style={styles.text}>{text}</Text>
          <Text style={styles.small}>
            Location: {result.location.latitude ? `±${Math.round(result.location.accuracy_m)} m, ${Math.round(result.location.fix_age_s)} s old${result.location.mock ? ' – MOCK LOCATION' : ''}` : result.location.permission}
          </Text>
          <Btn title="Scan next" onPress={() => onDone('scan')} />
          <Btn title="Home" tone="secondary" onPress={() => onDone('home')} />
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.h2}>{info?.tracking_id || trackingId}</Text>
        {offline && <Pill text="offline – item details unavailable; the server will check this scan later" tone="amber" />}
        {info && <Text style={styles.small}>Now: {info.status_label} · destination {info.destination_office}</Text>}
        {info?.recipient && (
          <Text style={styles.text}>{info.recipient.name}{'\n'}{[info.recipient.house_number, info.recipient.street, info.recipient.locality, info.recipient.city].filter(Boolean).join(', ')}</Text>
        )}
        {error ? <Text style={{ color: colors.red }}>{error}</Text> : null}
      </View>

      {options.length === 0 ? (
        <View style={styles.card}><Text style={styles.text}>You cannot record a status for this item now.</Text>
          <Btn title="Back" tone="secondary" onPress={() => onDone('home')} /></View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.h2}>New status</Text>
          {options.map((o) => (
            <Pressable key={o.status} onPress={() => setStatus(o.status)} accessibilityRole="radio" accessibilityState={{ checked: status === o.status }}
              style={[styles.input, status === o.status && { borderColor: colors.brand, borderWidth: 2 }]}>
              <Text style={styles.text}>{status === o.status ? '● ' : '○ '}{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {needsReason && (
        <View style={styles.card}>
          <Text style={styles.h2}>Reason</Text>
          <View style={styles.row}>{ATTEMPT_REASONS.map((r) => <Btn key={r} title={r} tone={reason === r ? 'primary' : 'secondary'} onPress={() => setReason(r)} style={{ paddingVertical: 6, minHeight: 36 }} />)}</View>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="or type a reason" />
        </View>
      )}

      {needsAck && (
        <View style={styles.card}>
          <Text style={styles.h2}>Delivery acknowledgement</Text>
          <View style={styles.row}>
            {[['signature', 'Signature'], ['recipient_name', 'Name only'], ['paper_sheet', 'Paper sheet no.']].map(([k, l]) => (
              <Btn key={k} title={l} tone={ackType === k ? 'primary' : 'secondary'} onPress={() => setAckType(k)} style={{ paddingVertical: 6, minHeight: 36 }} />
            ))}
          </View>
          {ackType !== 'paper_sheet' && <TextInput style={styles.input} value={recipientName} onChangeText={setRecipientName} placeholder="Name of person who received it" />}
          {ackType === 'paper_sheet' && <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Delivery sheet / page number" />}
          {ackType === 'signature' && <SignaturePad onChange={setSignature} />}
          <Text style={styles.small}>No acknowledgement possible? Describe the approved exception (the scan will be held for the postmaster):</Text>
          <TextInput style={styles.input} value={exception} onChangeText={setException} placeholder="exception reason (optional)" />
        </View>
      )}

      <Btn title="Save scan (records location now)" onPress={save} busy={busy}
        disabled={!status || !ackReady || (needsReason && reason.trim().length < 3)} />
      <Btn title="Cancel" tone="secondary" onPress={() => onDone('home')} />
      <Text style={styles.small}>Your location is read once, when you press Save, and is shown to the postmaster as evidence quality – not as proof of delivery.</Text>
    </ScrollView>
  )
}
