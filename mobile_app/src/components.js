import { useMemo, useRef, useState } from 'react'
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

export const colors = { brand: '#B4232A', brandDark: '#931C22', ink: '#1F2933', muted: '#52606D', line: '#CBD2D9', bg: '#F5F7FA',
  green: '#1E7B3A', amber: '#A15C07', red: '#B42318', blue: '#1D4ED8' }

export function Btn({ title, onPress, tone = 'primary', busy, disabled, style }) {
  const bg = { primary: colors.brand, secondary: '#fff', danger: colors.red }[tone]
  const fg = tone === 'secondary' ? colors.ink : '#fff'
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || busy}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        tone === 'secondary' && { borderWidth: 1, borderColor: colors.line }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  )
}

export function Pill({ text, tone = 'muted' }) {
  return <Text style={[styles.pill, { color: colors[tone], borderColor: colors[tone] }]}>{text}</Text>
}

// Finger signature captured as an SVG path (sent with a delivered scan).
export function SignaturePad({ onChange }) {
  const [paths, setPaths] = useState([])
  const current = useRef('')
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent
      current.current = `M${x.toFixed(1)},${y.toFixed(1)}`
      setPaths((p) => [...p, current.current])
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent
      current.current += ` L${x.toFixed(1)},${y.toFixed(1)}`
      setPaths((p) => [...p.slice(0, -1), current.current])
    },
    onPanResponderRelease: () => {
      setPaths((p) => {
        onChange(p.length ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><path d="${p.join(' ')}" stroke="black" fill="none" stroke-width="2"/></svg>` : '')
        return p
      })
    },
  }), [onChange])
  return (
    <View>
      <View style={styles.sigBox} {...responder.panHandlers}>
        <Svg width="100%" height="100%" viewBox="0 0 320 160">
          {paths.map((d, i) => <Path key={i} d={d} stroke="#111" strokeWidth={2} fill="none" />)}
        </Svg>
      </View>
      <Pressable onPress={() => { setPaths([]); onChange('') }}><Text style={{ color: colors.blue, marginTop: 4 }}>Clear signature</Text></Pressable>
    </View>
  )
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#FFE1E1', fontSize: 12 },
  body: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  text: { fontSize: 14, color: colors.ink },
  small: { fontSize: 12, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff', color: colors.ink },
  btn: { borderRadius: 8, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  btnText: { fontSize: 15, fontWeight: '700' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12, alignSelf: 'flex-start' },
  sigBox: { height: 160, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
})
