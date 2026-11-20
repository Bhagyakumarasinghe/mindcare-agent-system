import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';

const { width } = Dimensions.get('window');

/**
 * Reusable Glassmorphism Pop-Up Modal
 * Matches MindCare Dark Glass UI aesthetic with smooth native animations.
 *
 * Props:
 * - visible: boolean
 * - type: 'success' | 'error' | 'info'
 * - title: string
 * - message: string
 * - buttons: Array<{ text: string, onPress?: () => void, style?: 'default' | 'cancel' | 'destructive' }>
 * - onClose: () => void
 * - dismissible?: boolean (default: true)
 */
export default function GlassAlert({
  visible = false,
  type = 'info',
  title = '',
  message = '',
  buttons,
  onClose,
  dismissible = true,
}) {
  const [showModal, setShowModal] = useState(visible);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (showModal) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.88,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
      });
    }
  }, [visible]);

  const handleButtonPress = (btn) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.88,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowModal(false);
      if (onClose) onClose();
      if (btn && typeof btn.onPress === 'function') {
        btn.onPress();
      }
    });
  };

  if (!showModal) return null;

  // Determine icon & glowing colors based on type
  const isSuccess = type === 'success';
  const isError = type === 'error';

  const iconColor = isSuccess ? '#2DD4BF' : isError ? '#F87171' : '#38BDF8';
  const haloBg = isSuccess
    ? 'rgba(45, 212, 191, 0.14)'
    : isError
    ? 'rgba(248, 113, 113, 0.14)'
    : 'rgba(56, 189, 248, 0.14)';
  const haloBorder = isSuccess
    ? 'rgba(45, 212, 191, 0.45)'
    : isError
    ? 'rgba(248, 113, 113, 0.45)'
    : 'rgba(56, 189, 248, 0.45)';
  const haloShadow = isSuccess ? '#2DD4BF' : isError ? '#F87171' : '#38BDF8';

  // Card border glow
  const cardBorderColor = isSuccess
    ? 'rgba(45, 212, 191, 0.55)'
    : isError
    ? 'rgba(248, 113, 113, 0.50)'
    : 'rgba(45, 212, 191, 0.45)';

  // Action buttons
  const resolvedButtons =
    buttons && buttons.length > 0
      ? buttons
      : [{ text: 'OK', onPress: onClose }];

  return (
    <Modal
      transparent
      visible={showModal}
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (dismissible) handleButtonPress();
      }}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          if (dismissible) handleButtonPress();
        }}
      >
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View
              style={[
                styles.glassCard,
                {
                  borderColor: cardBorderColor,
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Status Icon Halo */}
              <View
                style={[
                  styles.iconHalo,
                  {
                    backgroundColor: haloBg,
                    borderColor: haloBorder,
                    shadowColor: haloShadow,
                  },
                ]}
              >
                {isSuccess ? (
                  <CheckCircle2 size={30} color={iconColor} strokeWidth={2.4} />
                ) : isError ? (
                  <AlertCircle size={30} color={iconColor} strokeWidth={2.4} />
                ) : (
                  <Info size={30} color={iconColor} strokeWidth={2.4} />
                )}
              </View>

              {/* Title */}
              {title ? <Text style={styles.title}>{title}</Text> : null}

              {/* Message */}
              {message ? <Text style={styles.message}>{message}</Text> : null}

              {/* Buttons */}
              <View
                style={[
                  styles.buttonsContainer,
                  resolvedButtons.length > 1 && styles.buttonsRow,
                ]}
              >
                {resolvedButtons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  return (
                    <TouchableOpacity
                      key={`glass-alert-btn-${index}`}
                      style={[
                        styles.button,
                        isCancel ? styles.cancelButton : styles.primaryButton,
                        resolvedButtons.length > 1 && styles.buttonFlex,
                      ]}
                      onPress={() => handleButtonPress(btn)}
                      activeOpacity={0.82}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel ? styles.cancelButtonText : styles.primaryButtonText,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

/**
 * Convenient React Hook to manage GlassAlert state easily in any screen
 */
export function useGlassAlert() {
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showAlert = (title, message, buttonsOrType, maybeType) => {
    let buttons = [];
    let type = 'info';

    if (Array.isArray(buttonsOrType)) {
      buttons = buttonsOrType;
      type = maybeType || 'info';
    } else if (typeof buttonsOrType === 'string') {
      type = buttonsOrType;
    }

    // Auto-detect type from title if not explicitly provided
    if (!type || type === 'info') {
      const lowerTitle = (title || '').toLowerCase();
      if (
        lowerTitle.includes('success') ||
        lowerTitle.includes('verified') ||
        lowerTitle.includes('created') ||
        lowerTitle.includes('welcome') ||
        lowerTitle.includes('recorded') ||
        lowerTitle.includes('enrolled')
      ) {
        type = 'success';
      } else if (
        lowerTitle.includes('error') ||
        lowerTitle.includes('failed') ||
        lowerTitle.includes('fail') ||
        lowerTitle.includes('invalid') ||
        lowerTitle.includes('mismatch') ||
        lowerTitle.includes('missing') ||
        lowerTitle.includes('incomplete') ||
        lowerTitle.includes('duplicate') ||
        lowerTitle.includes('required')
      ) {
        type = 'error';
      }
    }

    setAlertConfig({
      visible: true,
      title,
      message,
      buttons,
      type,
    });
  };

  const hideAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  return { alertConfig, showAlert, hideAlert };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 9, 20, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  glassCard: {
    width: '85%',
    maxWidth: 380,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(45, 212, 191, 0.45)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },
  iconHalo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    color: '#CBD5E1',
    fontSize: 14.5,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  buttonsContainer: {
    width: '100%',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFlex: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#0D9488',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
});

