import NetInfo from '@react-native-community/netinfo'
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { counts, pruneOld, recentEvents } from '../db'
import { Btn, Pill, colors, styles } from '../components'
import { syncNow } from '../sync'

const STATE_TONE = { pending: 'amber', accepted: 'green', duplicate: 'green', held: 'amber', rejected: 'red' }
const STATE_TEXT = { pending: 'waiting to upload', accepted: 'accepted', duplicate: 'already recorded', held: 'held for review', rejected: 'rejected' }

export default function HomeScreen({ session, onScan, onLogout }) {
  const [rows, setRows] = useState([])
  const [tally, setTally] = useState({})
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)

  const refresh = useCallback(async () => {
    setRows(await recentEvents())
    setTally(await counts())
  }, [])

  const sync = useCallback(async () => {
    setSyncing(true)
    try { setLastSync(await syncNow(session)) } finally { setSyncing(false); refresh() }
  }, [session, refresh])

  useEffect(() => {
    pruneOld().then(refresh)
    // Upload automatically whenever connectivity returns.
    const unsub = NetInfo.addEventListener((s) => {
      const isOnline = Boolean(s.isConnected && s.isInternetReachable !== false)
      setOnline(isOnline)
      if (isOnline) sync()
    })
    return unsub
  }, [refresh, sync])

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PostAssist Field</Text>
        <Text style={styles.headerSub}>{session.user.full_name} · {session.user.role.replace('_', ' ')} · {session.user.office_id}</Text>
      </View>
      <View style={styles.body}>
        <View style={[styles.card, { borderColor: online ? colors.line : colors.amber }]}>
          <View style={styles.row}>
            <Pill text={online ? 'online' : 'offline – scans are saved on this phone'} tone={online ? 'green' : 'amber'} />
            <Pill text={`${tally.pending || 0} pending`} tone={tally.pending ? 'amber' : 'muted'} />
            {tally.held ? <Pill text={`${tally.held} held`} tone="amber" /> : null}
            {tally.rejected ? <Pill text={`${tally.rejected} rejected`} tone="red" /> : null}
          </View>
          {lastSync?.error ? <Text style={[styles.small, { color: colors.red }]}>Last upload failed: {lastSync.error}</Text> : null}
          <Btn title="Scan registered letter" onPress={onScan} />
          <Btn title={syncing ? 'Uploading…' : 'Upload now'} tone="secondary" onPress={sync} busy={syncing} disabled={!tally.pending} />
        </View>
        <Text style={styles.h2}>Recent scans on this phone</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.event_id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        ListEmptyComponent={<Text style={styles.small}>No scans yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={[styles.text, { fontWeight: '700' }]}>{item.item_id}</Text>
            <View style={styles.row}>
              <Text style={styles.small}>{item.requested_status.replaceAll('_', ' ')} · {new Date(item.captured_at).toLocaleString()}</Text>
              <Pill text={STATE_TEXT[item.state] || item.state} tone={STATE_TONE[item.state] || 'muted'} />
            </View>
            {item.message ? <Text style={styles.small}>{item.message}</Text> : null}
            {item.state === 'pending' && item.last_error ? <Text style={[styles.small, { color: colors.amber }]}>retry pending: {item.last_error}</Text> : null}
          </View>
        )}
        ListFooterComponent={<Btn title="Sign out" tone="secondary" onPress={onLogout} style={{ marginTop: 16 }} disabled={Boolean(tally.pending)} />}
      />
    </View>
  )
}
