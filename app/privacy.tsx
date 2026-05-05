import { ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: April 2026</Text>

      <Text style={styles.heading}>Overview</Text>
      <Text style={styles.body}>
        Vowed ("the app") is a private, invite-only wedding app. Access is restricted to couples and their invited guests. We collect only the minimum data necessary to provide the app's features.
      </Text>

      <Text style={styles.heading}>Data We Collect</Text>
      <Text style={styles.body}>
        • <Text style={styles.bold}>Account information</Text>: email address and display name, used to identify you within your wedding party.{'\n\n'}
        • <Text style={styles.bold}>Profile photo</Text>: optionally uploaded by you, stored securely in Firebase Storage.{'\n\n'}
        • <Text style={styles.bold}>Posts and comments</Text>: content you submit to the wedding feed, visible only to members of your wedding party.{'\n\n'}
        • <Text style={styles.bold}>Device token</Text>: used to send push notifications for new posts and comments. You can disable this in your device settings.
      </Text>

      <Text style={styles.heading}>How We Use Your Data</Text>
      <Text style={styles.body}>
        Your data is used solely to provide the app's features — sharing photos, the schedule, and announcements within your private wedding party. We do not sell or share your data with third parties.
      </Text>

      <Text style={styles.heading}>Data Storage</Text>
      <Text style={styles.body}>
        All data is stored in Google Firebase (Firestore and Storage), protected by role-based access rules. Only members of your specific wedding party can access wedding data.
      </Text>

      <Text style={styles.heading}>Data Deletion</Text>
      <Text style={styles.body}>
        To have your account and data removed, contact the host of your wedding party or email us. Wedding data is retained only for the duration of the event and may be deleted at any time by the host.
      </Text>

      <Text style={styles.heading}>Children's Privacy</Text>
      <Text style={styles.body}>
        Vowed is not directed at children under 13. We do not knowingly collect personal information from children.
      </Text>

      <Text style={styles.heading}>Contact</Text>
      <Text style={styles.body}>
        For privacy questions or data deletion requests, contact the app developer through the App Store listing.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 24, paddingBottom: 60 },
  back: { marginBottom: 20 },
  backText: { fontSize: 14, color: theme.colors.accent, fontFamily: theme.fonts.sans },
  title: {
    fontSize: 28, fontWeight: '700', color: theme.colors.ink,
    fontFamily: theme.fonts.serif, marginBottom: 4,
  },
  updated: { fontSize: 12, color: theme.colors.ink4, fontFamily: theme.fonts.sans, marginBottom: 28 },
  heading: {
    fontSize: 14, fontWeight: '700', color: theme.colors.ink,
    fontFamily: theme.fonts.sans, marginTop: 24, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  body: { fontSize: 14, color: theme.colors.ink2, fontFamily: theme.fonts.sans, lineHeight: 22 },
  bold: { fontWeight: '700', color: theme.colors.ink },
});
