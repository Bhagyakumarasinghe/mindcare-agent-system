import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import {
  AlertTriangle,
  PhoneCall,
  Phone,
  HeartHandshake,
  ShieldAlert,
  X,
  ExternalLink,
} from 'lucide-react-native';

export function CrisisModal({
  visible,
  onClose,
  crisisData,
  source = 'MindCare Sanctuary',
}) {
  const handleCall = async (phoneNumber, name) => {
    const url = `tel:${phoneNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.warn('Direct dial error:', err);
      Alert.alert(
        'Direct Call Notice',
        `Please dial ${phoneNumber} directly on your phone dialer for ${name}.`
      );
    }
  };

  const helplines = crisisData?.helplines || [
    { name: 'National Mental Health Helpline', number: '1926' },
    { name: 'Sumithrayo Sri Lanka', number: '0112696666' },
  ];

  return (
    <Modal
      visible={Boolean(visible)}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Top Rose/Amber Urgent Status Header */}
          <View style={styles.alertTopBar}>
            <View style={styles.badgeRow}>
              <View style={styles.pulseDot} />
              <ShieldAlert size={16} color="#DC2626" />
              <Text style={styles.badgeText}>CRITICAL CLINICAL SUPPORT</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Dismiss crisis alert"
            >
              <X size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Compassionate Title & Reassurance */}
            <View style={styles.headerBox}>
              <View style={styles.iconCircle}>
                <AlertTriangle size={28} color="#E11D48" />
              </View>
              <Text style={styles.title}>You Are Not Alone</Text>
              <Text style={styles.subtitle}>
                Immediate confidential clinical care & compassionate human connection are ready for you right now.
              </Text>
            </View>

            {/* Reassuring Clinical Note */}
            <View style={styles.reassuranceCard}>
              <HeartHandshake size={20} color="#BE123C" style={{ marginTop: 2 }} />
              <Text style={styles.reassuranceText}>
                We noticed words indicating severe distress or painful thoughts. It takes great bravery to acknowledge when things feel too heavy to bear. Please reach out to these dedicated clinical professionals who care deeply about your safety.
              </Text>
            </View>

            {/* Helpline 1: National Mental Health Helpline (1926) */}
            <TouchableOpacity
              style={styles.primaryCallBtn}
              onPress={() => handleCall('1926', 'National Mental Health Helpline')}
              activeOpacity={0.88}
              accessibilityLabel="Call 1926 National Mental Health Helpline"
            >
              <View style={styles.callIconWrapper}>
                <PhoneCall size={22} color="#FFFFFF" />
              </View>
              <View style={styles.callTextWrapper}>
                <Text style={styles.callBtnTitle}>Call 1926 (National Helpline)</Text>
                <Text style={styles.callBtnSub}>Toll-Free • 24/7 Confidential Support</Text>
              </View>
            </TouchableOpacity>

            {/* Helpline 2: Sumithrayo Sri Lanka (011-2696666) */}
            <TouchableOpacity
              style={styles.secondaryCallBtn}
              onPress={() => handleCall('0112696666', 'Sumithrayo Sri Lanka')}
              activeOpacity={0.88}
              accessibilityLabel="Call 0112696666 Sumithrayo Sri Lanka"
            >
              <View style={styles.callSecondaryIconWrapper}>
                <Phone size={20} color="#B45309" />
              </View>
              <View style={styles.callTextWrapper}>
                <Text style={styles.callSecondaryTitle}>Call 011-2696666 (Sumithrayo)</Text>
                <Text style={styles.callSecondarySub}>Confidential Crisis Counseling & Befriending</Text>
              </View>
            </TouchableOpacity>

            {/* Safety Guidance Note */}
            <Text style={styles.safetyFootnote}>
              If you or someone around you is in immediate danger of self-harm, please visit the emergency unit of your nearest government or teaching hospital immediately.
            </Text>

            {/* Return / Safe Space Dismiss */}
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissBtnText}>I am in a safe space • Return</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  alertTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E6',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E11D48',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9F1239',
    letterSpacing: 0.6,
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    padding: 20,
    alignItems: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  reassuranceCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 18,
  },
  reassuranceText: {
    flex: 1,
    fontSize: 12.5,
    color: '#9A3412',
    lineHeight: 18,
    fontWeight: '500',
  },
  primaryCallBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E11D48',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  callIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  callTextWrapper: {
    flex: 1,
  },
  callBtnTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  callBtnSub: {
    color: '#FFE4E6',
    fontSize: 11,
    fontWeight: '600',
  },
  secondaryCallBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  callSecondaryIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  callSecondaryTitle: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  callSecondarySub: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '600',
  },
  safetyFootnote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  dismissBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  dismissBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
});

export { CrisisModal as EmergencyModal };
export default CrisisModal;
