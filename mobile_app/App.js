import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, BackHandler, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { loadSession, saveSession } from './src/api'
import { colors } from './src/components'
import { getDb } from './src/db'
import EventScreen from './src/screens/EventScreen'
import HomeScreen from './src/screens/HomeScreen'
import LoginScreen from './src/screens/LoginScreen'
import ScanScreen from './src/screens/ScanScreen'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [route, setRoute] = useState({ name: 'home' })

  useEffect(() => {
    getDb().then(loadSession).then((s) => setSession(s.token ? s : { ...s, token: null }))
  }, [])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name === 'home') return false
      setRoute({ name: 'home' })
      return true
    })
    return () => sub.remove()
  }, [route.name])

  if (session === undefined) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View>
  }

  let screen
  if (!session.token) {
    screen = <LoginScreen initialServer={session.server} onLoggedIn={(s) => { setSession(s); setRoute({ name: 'home' }) }} />
  } else if (route.name === 'scan') {
    screen = <ScanScreen onCancel={() => setRoute({ name: 'home' })} onScanned={(id) => setRoute({ name: 'event', trackingId: id })} />
  } else if (route.name === 'event') {
    screen = <EventScreen session={session} trackingId={route.trackingId} onDone={(next) => setRoute({ name: next })} />
  } else {
    screen = (
      <HomeScreen session={session} onScan={() => setRoute({ name: 'scan' })}
        onLogout={async () => { await saveSession({ token: null }); setSession({ ...session, token: null }) }} />
    )
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.brand }} edges={['top']}>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>{screen}</View>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
