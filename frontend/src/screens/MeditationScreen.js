import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Animated, 
  Easing, 
  Alert,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RotateCcw, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Headphones, 
  CloudRain, 
  Wind, 
  Bell, 
  CheckCircle2,
  Clock,
  Waves,
  Flame,
  Music,
  Moon
} from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSafeAudioPlayer } from '../utils/safeAudio';
import { logActivity } from '../api/authService';

const { width } = Dimensions.get('window');
const TOTAL_DURATION = 5 * 60; // 5 Minutes (300 Seconds)

// 10 Distinct Ambient & Clinical Soundscapes
const SOUNDSCAPES = [
  {
    id: 'rain_waves',
    title: 'Calming Ambient Rain & Waves',
    subtitle: 'Gentle precipitation & soft shorelines',
    category: 'Decompression',
    icon: 'Rain',
    source: require('../../assets/calm_ambient.mp3'),
  },
  {
    id: 'forest_stream',
    title: 'Forest Birds & Stream',
    subtitle: 'Woodland canopy & flowing stream',
    category: 'Restoration',
    icon: 'Forest',
    source: { uri: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_db6591201e.mp3' },
  },
  {
    id: 'zen_bowls',
    title: 'Deep Zen Tibetan Bowls',
    subtitle: 'Harmonic Tibetan resonant tones',
    category: 'Alpha Waves',
    icon: 'Bowls',
    source: { uri: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f795cb.mp3' },
  },
  {
    id: 'binaural_alpha',
    title: 'Binaural Alpha Waves (Focus 10Hz)',
    subtitle: '10Hz alpha frequency for cognitive flow',
    category: 'Focus',
    icon: 'Waves',
    source: { uri: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3' },
  },
  {
    id: 'white_noise',
    title: 'Gentle White Noise',
    subtitle: 'Consistent acoustic masking for calm',
    category: 'Clarity',
    icon: 'Wind',
    source: { uri: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_88447e769f.mp3' },
  },
  {
    id: 'midnight_campfire',
    title: 'Midnight Campfire',
    subtitle: 'Gentle crackle & soothing warmth',
    category: 'Grounding',
    icon: 'Flame',
    source: { uri: 'https://cdn.pixabay.com/download/audio/2022/03/09/audio_c8c8a73467.mp3' },
  },
  {
    id: 'ocean_surf',
    title: 'Ocean Surf at Dusk',
    subtitle: 'Rhythmic tides & maritime tranquility',
    category: 'Relaxation',
    icon: 'Waves',
    source: { uri: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_3457a8236c.mp3' },
  },
  {
    id: 'piano_sanctuary',
    title: 'Soft Piano Sanctuary',
    subtitle: 'Minimalist restorative acoustic melodies',
    category: 'Serenity',
    icon: 'Music',
    source: { uri: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3' },
  },
  {
    id: 'delta_waves',
    title: 'Delta Waves Deep Reset',
    subtitle: 'Low-frequency somatic sleep & restoration',
    category: 'Deep Sleep',
    icon: 'Moon',
    source: { uri: 'https://cdn.pixabay.com/download/audio/2022/11/06/audio_c3c3a9f0e8.mp3' },
  },
  {
    id: 'autumn_wind',
    title: 'Autumn Wind & Leaves',
    subtitle: 'Gentle breeze whispering through foliage',
    category: 'Presence',
    icon: 'Wind',
    source: { uri: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_7314d68233.mp3' },
  },
];

const MeditationScreen = ({ navigation }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsSpent, setSecondsSpent] = useState(0);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState('Inhale');

  const timeSpentRef = useRef(0);
  timeSpentRef.current = secondsSpent;
  const soundRef = useRef(null);

  // Soothing breathing pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  // Pulse animation loop
  useEffect(() => {
    let animLoop = null;
    if (isPlaying) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 4000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.85,
              duration: 4000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.0,
              duration: 4000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.4,
              duration: 4000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animLoop.start();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.4);
    }

    return () => {
      if (animLoop) animLoop.stop();
    };
  }, [isPlaying]);

  // Derive breathing cycle guidance (8s full cycle: 4s Inhale, 4s Exhale)
  useEffect(() => {
    if (!isPlaying) {
      setBreathingPhase('Mindful Rest');
      return;
    }
    const cycle = secondsSpent % 8;
    if (cycle < 4) {
      setBreathingPhase('Inhale Slowly');
    } else {
      setBreathingPhase('Exhale Gently');
    }
  }, [secondsSpent, isPlaying]);

  // Audio Playback Controller
  const switchAudioTrack = async (trackIndex, playImmediately = false) => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const track = SOUNDSCAPES[trackIndex];
      if (!track) return;
      const player = await createSafeAudioPlayer(track.source, {
        loop: true,
        volume: isMuted ? 0 : 0.85,
      });

      soundRef.current = player;
      if (playImmediately) {
        await player.playAsync();
      }
    } catch (err) {
      console.log('Meditation track change error:', err);
    }
  };

  // Play / Pause handling
  useEffect(() => {
    const handlePlayState = async () => {
      try {
        if (isPlaying) {
          if (!soundRef.current) {
            await switchAudioTrack(selectedTrackIndex, true);
          } else {
            await soundRef.current.playAsync();
          }
        } else {
          if (soundRef.current) {
            await soundRef.current.pauseAsync();
          }
        }
      } catch (err) {
        console.log('Audio playback state error:', err);
      }
    };
    handlePlayState();
  }, [isPlaying]);

  // Handle Track Selection
  const handleSelectTrack = async (index) => {
    if (index === selectedTrackIndex) return;
    setSelectedTrackIndex(index);
    if (isPlaying) {
      await switchAudioTrack(index, true);
    } else {
      await switchAudioTrack(index, false);
    }
  };

  // Mute / Unmute
  const toggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (soundRef.current) {
      await soundRef.current.setMuted(nextMuted);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // Backend session activity logging
  const logSessionActivity = async (durationSec) => {
    if (durationSec < 10) return;
    try {
      const userStr = await AsyncStorage.getItem('user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const resolvedUserId = parsedUser?.id || 'demo_user';
      const durationMinutes = Math.max(1, Math.round(durationSec / 60));

      await logActivity({
        user_id: resolvedUserId,
        activity_type: 'Guided Meditation',
        duration_minutes: durationMinutes,
        metadata: {
          track_name: SOUNDSCAPES[selectedTrackIndex]?.title || 'Ambient Sanctuary'
        }
      });
    } catch (err) {
      console.log('Meditation activity logging error:', err.message || err);
    }
  };

  // Timer Tick
  useEffect(() => {
    let timer = null;
    if (isPlaying && secondsSpent < TOTAL_DURATION) {
      timer = setInterval(() => {
        setSecondsSpent((prev) => {
          const next = prev + 1;
          timeSpentRef.current = next;
          return next;
        });
      }, 1000);
    } else if (secondsSpent >= TOTAL_DURATION) {
      setIsPlaying(false);
      logSessionActivity(TOTAL_DURATION);
      Alert.alert(
        "Sanctuary Completed 🧘",
        "You have completed your 5-minute mindful decompression session. Autonomic balance restored.",
        [{ text: "Complete", onPress: () => setSecondsSpent(0) }]
      );
    }
    return () => clearInterval(timer);
  }, [isPlaying, secondsSpent]);

  // Back Navigation with cleanup
  const handleGoBack = async () => {
    setIsPlaying(false);
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    await logSessionActivity(timeSpentRef.current);
    navigation.goBack();
  };

  const handleReset = () => {
    setIsPlaying(false);
    setSecondsSpent(0);
    timeSpentRef.current = 0;
  };

  const handleSkipForward = () => {
    setSecondsSpent((prev) => Math.min(TOTAL_DURATION, prev + 15));
  };

  const handleSkipBack = () => {
    setSecondsSpent((prev) => Math.max(0, prev - 15));
  };

  const formatTime = (seconds) => {
    const clamped = Math.max(0, TOTAL_DURATION - seconds);
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Circular progress calculations (Radius 88)
  const circleRadius = 88;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * circleRadius;
  const progressRatio = Math.min(1, secondsSpent / TOTAL_DURATION);
  const strokeDashoffset = circumference - (circumference * progressRatio);

  const activeTrack = SOUNDSCAPES[selectedTrackIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} activeOpacity={0.8}>
          <ArrowLeft color="#0D9488" size={22} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Audio Sanctuary</Text>
          <Text style={styles.headerSubtitle}>Guided Mindfulness & Decompression</Text>
        </View>
        <TouchableOpacity onPress={toggleMute} style={styles.muteBtn} activeOpacity={0.8}>
          {isMuted ? (
            <VolumeX color="#EF4444" size={20} />
          ) : (
            <Volume2 color="#0D9488" size={20} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Circular Progress Timer Sanctuary Area */}
        <View style={styles.timerSanctuaryContainer}>
          {/* Animated Glow Aura Ring */}
          <Animated.View 
            style={[
              styles.timerAuraGlow, 
              {
                transform: [{ scale: pulseAnim }],
                opacity: isPlaying ? pulseOpacity : 0.15,
              }
            ]} 
          />

          {/* SVG Circular Progress Ring */}
          <View style={styles.svgWrapper}>
            <Svg width={230} height={230} viewBox="0 0 230 230">
              {/* Background Track Circle */}
              <Circle
                cx="115"
                cy="115"
                r={circleRadius}
                stroke="#E2E8F0"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Active Progress Circle */}
              <Circle
                cx="115"
                cy="115"
                r={circleRadius}
                stroke="#0D9488"
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                transform="rotate(-90 115 115)"
              />
            </Svg>

            {/* Inner Content inside Circular Timer */}
            <View style={styles.timerInnerContent}>
              <View style={styles.phaseBadge}>
                <Text style={styles.phaseBadgeText}>{breathingPhase}</Text>
              </View>
              <Text style={styles.countdownText}>{formatTime(secondsSpent)}</Text>
              <Text style={styles.totalDurationText}>5:00 Session</Text>
            </View>
          </View>
        </View>

        {/* Current Active Track Banner */}
        <View style={styles.activeTrackBanner}>
          <View style={styles.activeTrackLeft}>
            <View style={styles.activeIconCircle}>
              <Headphones size={18} color="#0D9488" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTrackName}>{activeTrack.title}</Text>
              <Text style={styles.activeTrackCategory}>{activeTrack.subtitle}</Text>
            </View>
          </View>
          <View style={styles.liveIndicator}>
            <View style={[styles.liveDot, { backgroundColor: isPlaying ? '#0D9488' : '#94A3B8' }]} />
            <Text style={[styles.liveText, { color: isPlaying ? '#0D9488' : '#94A3B8' }]}>
              {isPlaying ? 'ACTIVE' : 'PAUSED'}
            </Text>
          </View>
        </View>

        {/* Primary Teal (#0D9488) Playback Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={styles.secondaryControlBtn} 
            onPress={handleReset}
            activeOpacity={0.8}
          >
            <RotateCcw size={22} color="#0F766E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryControlBtn} 
            onPress={handleSkipBack}
            activeOpacity={0.8}
          >
            <SkipBack size={24} color="#0F766E" />
          </TouchableOpacity>

          {/* Big Teal Play/Pause CTA */}
          <TouchableOpacity 
            style={styles.primaryPlayBtn} 
            onPress={() => setIsPlaying(!isPlaying)}
            activeOpacity={0.85}
          >
            {isPlaying ? (
              <Pause size={34} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Play size={34} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryControlBtn} 
            onPress={handleSkipForward}
            activeOpacity={0.8}
          >
            <SkipForward size={24} color="#0F766E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryControlBtn} 
            onPress={toggleMute}
            activeOpacity={0.8}
          >
            {isMuted ? (
              <VolumeX size={22} color="#EF4444" />
            ) : (
              <Volume2 size={22} color="#0F766E" />
            )}
          </TouchableOpacity>
        </View>

        {/* Multi-Track Selector Component */}
        <View style={styles.selectorSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Ambient Soundscapes</Text>
            <Text style={styles.sectionSubtitle}>Choose neural frequency</Text>
          </View>

          <View style={styles.tracksList}>
            {SOUNDSCAPES.map((item, index) => {
              const isSelected = selectedTrackIndex === index;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.trackCard,
                    isSelected && styles.trackCardActive
                  ]}
                  onPress={() => handleSelectTrack(index)}
                  activeOpacity={0.85}
                >
                  <View style={[
                    styles.trackIconWrap,
                    isSelected && styles.trackIconWrapActive
                  ]}>
                    {item.icon === 'Rain' && <CloudRain size={20} color={isSelected ? '#0D9488' : '#64748B'} />}
                    {item.icon === 'Forest' && <Wind size={20} color={isSelected ? '#0D9488' : '#64748B'} />}
                    {item.icon === 'Bowls' && <Bell size={20} color={isSelected ? '#0D9488' : '#64748B'} />}
                    {item.icon === 'Waves' && <Waves size={20} color={isSelected ? '#0D9488' : '#64748B'} />}
                    {item.icon === 'Wind' && <Wind size={20} color={isSelected ? '#0D9488' : '#64748B'} />}
                    {item.icon === 'Flame' && <Flame size={20} color={isSelected ? '#0D9488' : '#64748B'} />}
                    {item.icon === 'Music' && <Music size={20} color={isSelected ? '#0D9488' : '#64748B'} />}
                    {item.icon === 'Moon' && <Moon size={20} color={isSelected ? '#0D9488' : '#64748B'} />}
                  </View>

                  <View style={styles.trackDetails}>
                    <View style={styles.trackTopRow}>
                      <Text style={[
                        styles.trackTitle,
                        isSelected && styles.trackTitleActive
                      ]}>
                        {item.title}
                      </Text>
                      {isSelected && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>Selected</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.trackDesc}>{item.subtitle}</Text>
                  </View>

                  <View style={styles.trackRightIndicator}>
                    {isSelected ? (
                      <CheckCircle2 size={22} color="#0D9488" />
                    ) : (
                      <View style={styles.inactiveCircle} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Clinical Note Footer */}
        <View style={styles.clinicalSanctuaryNotice}>
          <Clock size={16} color="#0D9488" style={{ marginTop: 2 }} />
          <Text style={styles.clinicalNoticeText}>
            Mindful audio pauses down-regulate the sympathetic nervous response and enhance alpha brainwave synchronization during demanding academic blocks.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  muteBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  timerSanctuaryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    height: 250,
  },
  timerAuraGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#CCFBF1',
  },
  svgWrapper: {
    width: 230,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerInnerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseBadge: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 6,
  },
  phaseBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countdownText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: -1,
  },
  totalDurationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  activeTrackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  activeTrackLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  activeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  activeTrackName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  activeTrackCategory: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 26,
  },
  secondaryControlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  primaryPlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  selectorSection: {
    marginTop: 6,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tracksList: {
    gap: 10,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    elevation: 1,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  trackCardActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  trackIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  trackIconWrapActive: {
    backgroundColor: '#CCFBF1',
  },
  trackDetails: {
    flex: 1,
    marginRight: 8,
  },
  trackTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  trackTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginRight: 6,
  },
  trackTitleActive: {
    color: '#0F766E',
    fontWeight: '800',
  },
  trackDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  activePill: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    flexShrink: 0,
    alignSelf: 'center',
  },
  activePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  trackRightIndicator: {
    marginLeft: 4,
    flexShrink: 0,
  },
  inactiveCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  clinicalSanctuaryNotice: {
    flexDirection: 'row',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  clinicalNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#0F766E',
    lineHeight: 18,
    fontWeight: '500',
  },
});

export default MeditationScreen;
