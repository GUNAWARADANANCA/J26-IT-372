import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Btn, colors, styles } from '../components'

// Scans the Code 128 barcode or the QR code on the label; both hold only the tracking ID.
export default function ScanScreen({ onScanned, onCancel }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [manual, setManual] = useState('')
  const done = useRef(false)

  if (!permission) return <View style={styles.screen} />
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan label</Text>
        <Text style={styles.headerSub}>Point the camera at the barcode or QR code</Text>
      </View>
      {permission.granted ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['code128', 'qr'] }}
          onBarcodeScanned={({ data }) => {
            if (done.current || !data) return
            done.current = true
            onScanned(data.trim())
          }}
        />
      ) : (
        <View style={styles.body}>
          <Text style={styles.text}>Camera permission is needed to scan labels.</Text>
          <Btn title="Allow camera" onPress={requestPermission} />
        </View>
      )}
      <View style={[styles.body, { backgroundColor: '#fff', borderTopWidth: 1, borderColor: colors.line }]}>
        <Text style={styles.small}>Damaged label? Type the ID printed under the barcode.</Text>
        <TextInput style={styles.input} value={manual} onChangeText={setManual} autoCapitalize="characters" placeholder="PA-DEMO-XXXXXXXXXXX" />
        <View style={styles.row}>
          <Btn title="Use typed ID" onPress={() => onScanned(manual.trim())} disabled={manual.trim().length < 8} style={{ flex: 1 }} />
          <Btn title="Cancel" tone="secondary" onPress={onCancel} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  )
}
