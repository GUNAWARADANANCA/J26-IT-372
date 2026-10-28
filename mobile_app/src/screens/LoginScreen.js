import { useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { login } from '../api'
import { Btn, colors, styles } from '../components'

export default function LoginScreen({ initialServer, onLoggedIn }) {
  const [server, setServer] = useState(initialServer || 'http://192.168.1.10:8000')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    try {
      onLoggedIn(await login(server.trim(), username.trim().toLowerCase(), password))
    } catch (e) {
      setError(e.message === 'Aborted' || e.name === 'AbortError' ? 'Server did not answer. Check the address and that the phone is on the same Wi-Fi.' : e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={[styles.h2, { color: colors.brand }]}>PostAssist Field</Text>
        <Text style={styles.small}>Registered-letter scans for postmen and hub officers. Works offline after sign-in.</Text>
        <Text style={styles.text}>Server address</Text>
        <TextInput style={styles.input} value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false}
          keyboardType="url" accessibilityLabel="Server address" />
        <Text style={styles.small}>The laptop running the backend, e.g. http://192.168.1.10:8000 (same Wi-Fi).</Text>
        <Text style={styles.text}>Username</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Username" />
        <Text style={styles.text}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry accessibilityLabel="Password" />
        {error ? <Text style={{ color: colors.red }}>{error}</Text> : null}
        <Btn title="Sign in" onPress={submit} busy={busy} disabled={!username || !password} />
      </View>
    </ScrollView>
  )
}
