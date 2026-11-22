import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Dimensions,
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
  CloudRain, 
  Wind, 
  Bell, 
  Waves, 
  Music,
} from 'lucide-react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity } from '../api/authService';
import { recordRelaxSession } from '../utils/activityTracker';

const { width } = Dimensions.get('window');

// 3 Curated Immersive Visual Sanctuary Video Scenes
const VISUAL_SCENES = [
  {
    id: 'sanctuary',
    label: 'Dreamy Sanctuary',
    source: require('../../assets/videos/calm-sanctuary.mp4'),
  },
  {
    id: 'horizon',
    label: 'Serene Horizon',
    source: require('../../assets/videos/background-video-1.mp4'),
  },
  {
    id: 'flow',
    label: 'Mindful Flow',
    source: require('../../assets/videos/mood-banner-video.mp4'),
  },
];

// 4 Interactive Session Duration Presets
const DURATION_PRESETS = [
  { label: '3m', seconds: 3 * 60 },
  { label: '5m', seconds: 5 * 60 },
  { label: '10m', seconds: 10 * 60 },
  { label: '15m', seconds: 15 * 60 },
];

// 7 Bundled Local Audio Soundscapes with High-Fidelity Audio Loops
const SOUNDSCAPES = [
  {
    id: 'rain_waves',
    title: 'Calming Ambient Rain & Waves',
    subtitle: 'Gentle precipitation & soft shorelines',
    category: 'Decompression',
    icon: 'CloudRain',
    source: require('../../assets/audio/mixkit-light-rain-loop-2393.wav'),
  },
  {
    id: 'forest_stream',
    title: 'Forest Birds & Stream',
    subtitle: 'Woodland canopy & flowing stream',
    category: 'Restoration',
    icon: 'Wind',
    source: require('../../assets/audio/baranova_n-water-stream-636804.mp3'),
  },
  {
    id: 'zen_bowls',
    title: 'Deep Zen Tibetan Bowls',
    subtitle: 'Harmonic Tibetan resonant tones',
    category: 'Alpha Waves',
    icon: 'Bell',
    source: require('../../assets/audio/freesound_community-singing-bell-hit-1-105400.mp3'),
  },
  {
    id: 'binaural_alpha',
    title: 'Binaural Alpha Waves (Focus 10Hz)',
    subtitle: 'Dreamy ambient pads for cognitive flow',
    category: 'Focus Flow',
    icon: 'Waves',
    source: require('../../assets/audio/alpha-samples-bandcamp-alpha-samples-200-dreamy-pads-sample-pack-246890.mp3'),
  },
  {
    id: 'white_noise',
    title: 'Gentle White Noise',
    subtitle: 'Consistent acoustic masking for calm',
    category: 'Clarity',
    icon: 'Wind',
    source: require('../../assets/audio/extrasounds-white-noise-358382.mp3'),
  },
  {
    id: 'thunder_rain',
    title: 'Thunder & Light Rain',
    subtitle: 'Distant thunder rumble & soothing rain',
    category: 'Grounding',
    icon: 'CloudRain',
    source: require('../../assets/audio/mixkit-thunder-rumble-and-light-rain-2401.wav'),
  },
  {
    id: 'ocean_surf',
    title: 'Ocean Surf at Dusk',
    subtitle: 'Rhythmic tides & maritime tranquility',
    category: 'Relaxation',
    icon: 'Waves',
    source: require('../../assets/audio/dragon-studio-ocean-waves-376898.mp3'),
  },
];

const MeditationScreen = ({ navigation }) => {
  const [sessionDuration, setSessionDuration] = useState(5 * 60); // Default 5 min
  const [secondsSpent, setSecondsSpent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const timeSpentRef = useRef(0);
  timeSpentRef.current = secondsSpent;

  const activeTrack = SOUNDSCAPES[selectedTrackIndex];
  const activeScene = VISUAL_SCENES[activeSceneIndex];

  // 1. expo-video Player for Visual Sanctuary
  const videoPlayer = useVideoPlayer(activeScene.source, (player) => {
    player.loop = true;
    player.muted = true;
  });

  // 2. expo-audio Player for Curated Soundscapes
  const audioPlayer = useAudioPlayer(activeTrack.source);

  // Configure Audio Mode once on mount (expo-audio)
  useEffect(() => {
    const initAudioMode = async () => {
      try {
        if (typeof setAudioModeAsync === 'function') {
          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldDuckAndroid: true,
          });
        }
      } catch (err) {
        console.warn('expo-audio setAudioModeAsync notice:', err?.message || err);
      }
    };
    initAudioMode();
  }, []);

  // Sync Audio Player settings (loop, mute, volume)
  useEffect(() => {
    if (audioPlayer) {
      try {
        audioPlayer.loop = true;
        audioPlayer.volume = isMuted ? 0 : 0.85;
      } catch (e) {}
    }
  }, [audioPlayer, isMuted]);

  // Sync Play / Pause state with both Audio and Video players
  useEffect(() => {
    if (audioPlayer) {
      try {
        if (isPlaying) {
          audioPlayer.play();
        } else {
          audioPlayer.pause();
        }
      } catch (err) {
        console.warn('Audio play/pause error:', err?.message || err);
      }
    }

    if (videoPlayer) {
      try {
        if (isPlaying) {
          videoPlayer.play();
        } else {
          videoPlayer.pause();
        }
      } catch (err) {
        console.warn('Video play/pause error:', err?.message || err);
      }
    }
  }, [isPlaying, audioPlayer, videoPlayer]);

  // Handle Audio Track Switch
  const handleSelectTrack = (index) => {
    if (index === selectedTrackIndex) return;
    setSelectedTrackIndex(index);
    if (audioPlayer) {
      try {
        audioPlayer.replace(SOUNDSCAPES[index].source);
        audioPlayer.loop = true;
        audioPlayer.volume = isMuted ? 0 : 0.85;
        if (isPlaying) {
          audioPlayer.play();
        }
      } catch (err) {
        console.warn('Audio switch error:', err?.message || err);
      }
    }
  };

  // Switch Visual Video Scene
  const handleSwitchVisual = () => {
    const nextIndex = (activeSceneIndex + 1) % VISUAL_SCENES.length;
    setActiveSceneIndex(nextIndex);
    if (videoPlayer) {
      try {
        videoPlayer.replace(VISUAL_SCENES[nextIndex].source);
        if (isPlaying) {
          videoPlayer.play();
        }
      } catch (err) {
        console.warn('Video switch error:', err?.message || err);
      }
    }
  };

  // Mute / Unmute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioPlayer) {
      try {
        audioPlayer.muted = nextMuted;
        audioPlayer.volume = nextMuted ? 0 : 0.85;
      } catch (e) {}
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioPlayer) {
        try {
          audioPlayer.pause();
        } catch (e) {}
      }
      if (videoPlayer) {
        try {
          videoPlayer.pause();
        } catch (e) {}
      }
    };
  }, [audioPlayer, videoPlayer]);

  // Backend session activity logging
  const logSessionActivity = async (durationSec) => {
    if (durationSec < 10) return;
    try {
      let resolvedUserId = '';
      try {
        const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
        if (cachedProf) {
          const cp = JSON.parse(cachedProf);
          resolvedUserId = cp?.id || cp?.user_id || '';
        }
      } catch {
        // ignore
      }
      if (!resolvedUserId) {
        const userStr = await AsyncStorage.getItem('user');
        const parsedUser = userStr ? JSON.parse(userStr) : null;
        resolvedUserId = parsedUser?.id || parsedUser?.user_id || 'demo_user';
      }

      const durationMinutes = Math.max(1, Math.round(durationSec / 60));

      // Synchronize live activity counter for relaxation first so it always persists
      await recordRelaxSession(resolvedUserId, durationMinutes, 'Guided Meditation');

      try {
        await logActivity({
          user_id: resolvedUserId && resolvedUserId !== 'demo_user' ? resolvedUserId : undefined,
          activity_type: 'Guided Meditation',
          duration_minutes: durationMinutes,
          metadata: {
            track_name: SOUNDSCAPES[selectedTrackIndex]?.title || 'Ambient Sanctuary',
            visual_scene: VISUAL_SCENES[activeSceneIndex]?.label,
            seconds_spent: durationSec,
          }
        });
      } catch (beErr) {
        console.warn('Backend meditation activity notice:', beErr?.message || beErr);
      }
    } catch (err) {
      console.log('Meditation activity logging error:', err?.message || err);
    }
  };

  // Timer Tick & Session Completion
  useEffect(() => {
    let timer = null;
    if (isPlaying && secondsSpent < sessionDuration) {
      timer = setInterval(() => {
        setSecondsSpent((prev) => {
          const next = prev + 1;
          timeSpentRef.current = next;
          return next;
        });
      }, 1000);
    } else if (secondsSpent >= sessionDuration && sessionDuration > 0) {
      setIsPlaying(false);
      logSessionActivity(sessionDuration);
      Alert.alert(
        "Sanctuary Completed 🧘",
        `You have completed your ${Math.round(sessionDuration / 60)}-minute mindful decompression session. Autonomic balance restored.`,
        [{ text: "Complete", onPress: () => setSecondsSpent(0) }]
      );
    }
    return () => clearInterval(timer);
  }, [isPlaying, secondsSpent, sessionDuration]);

  // Back Navigation with cleanup
  const handleGoBack = async () => {
    setIsPlaying(false);
    if (audioPlayer) {
      try {
        audioPlayer.pause();
      } catch (e) {}
    }
    if (videoPlayer) {
      try {
        videoPlayer.pause();
      } catch (e) {}
    }
    await logSessionActivity(timeSpentRef.current);
    navigation.goBack();
  };

  const handleReset = () => {
    setIsPlaying(false);
    setSecondsSpent(0);
    timeSpentRef.current = 0;
    if (audioPlayer) {
      try {
        audioPlayer.pause();
        if (typeof audioPlayer.seekTo === 'function') {
          audioPlayer.seekTo(0);
        }
      } catch (e) {}
    }
    if (videoPlayer) {
      try {
        videoPlayer.pause();
      } catch (e) {}
    }
  };

  const handleSkipForward = () => {
    setSecondsSpent((prev) => Math.min(sessionDuration, prev + 15));
  };

  const handleSkipBack = () => {
    setSecondsSpent((prev) => Math.max(0, prev - 15));
  };

  const handleSelectDuration = (seconds) => {
    setSessionDuration(seconds);
    setSecondsSpent(0);
    timeSpentRef.current = 0;
  };

  const formatTime = (seconds) => {
    const clamped = Math.max(0, sessionDuration - seconds);
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderTrackIcon = (iconName, isSelected) => {
    const color = isSelected ? '#0D9488' : '#64748B';
    switch (iconName) {
      case 'CloudRain':
        return <CloudRain size={20} color={color} />;
      case 'Wind':
        return <Wind size={20} color={color} />;
      case 'Bell':
        return <Bell size={20} color={color} />;
      case 'Waves':
        return <Waves size={20} color={color} />;
      default:
        return <Music size={20} color={color} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Ambient Translucent Mint-Teal and Soft Sky-Blue Circles (HomeScreen aesthetic) */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} activeOpacity={0.8}>
            <ArrowLeft color="#0D9488" size={20} />
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
          {/* Duration Preset Selector Pills */}
          <View style={styles.durationPresetRow}>
            {DURATION_PRESETS.map((preset) => {
              const isSelected = sessionDuration === preset.seconds;
              return (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.durationPill,
                    isSelected && styles.durationPillActive,
                  ]}
                  onPress={() => handleSelectDuration(preset.seconds)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.durationPillText,
                      isSelected && styles.durationPillTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 1. Immersive Visual Sanctuary Video Card (Tap to cycle visual scenes) */}
          <TouchableOpacity 
            style={styles.videoCardContainer}
            onPress={handleSwitchVisual}
            activeOpacity={0.95}
          >
            <VideoView
              style={StyleSheet.absoluteFill}
              player={videoPlayer}
              contentFit="cover"
              nativeControls={false}
            />
          </TouchableOpacity>

          {/* Soft Frosted White Glass Bar Directly Below Video */}
          <View style={styles.nowPlayingBar}>
            <View style={styles.nowPlayingLeft}>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                {activeTrack.title}
              </Text>
              <View style={styles.nowPlayingStatusRow}>
                <View 
                  style={[
                    styles.statusDot, 
                    { backgroundColor: isPlaying ? '#0D9488' : '#94A3B8' }
                  ]} 
                />
                <Text 
                  style={[
                    styles.statusText, 
                    { color: isPlaying ? '#0D9488' : '#94A3B8' }
                  ]}
                >
                  {isPlaying ? 'Playing' : 'Paused'}
                </Text>
              </View>
            </View>
            <View style={styles.nowPlayingRight}>
              <Text style={styles.nowPlayingTimer}>
                {formatTime(secondsSpent)}
              </Text>
            </View>
          </View>

          {/* Primary Teal Playback Controls Row */}
          <View style={styles.controlsRow}>
            <TouchableOpacity 
              style={styles.secondaryControlBtn} 
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <RotateCcw size={20} color="#0F766E" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryControlBtn} 
              onPress={handleSkipBack}
              activeOpacity={0.8}
            >
              <SkipBack size={22} color="#0F766E" />
            </TouchableOpacity>

            {/* Big Teal Play/Pause CTA */}
            <TouchableOpacity 
              style={styles.primaryPlayBtn} 
              onPress={() => setIsPlaying(!isPlaying)}
              activeOpacity={0.85}
            >
              {isPlaying ? (
                <Pause size={30} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={30} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 3 }} />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryControlBtn} 
              onPress={handleSkipForward}
              activeOpacity={0.8}
            >
              <SkipForward size={22} color="#0F766E" />
            </TouchableOpacity>
          </View>

          {/* Soundscapes List (Soft Frosted White Glass Cards) */}
          <View style={styles.soundscapeSection}>
            <Text style={styles.sectionHeaderTitle}>Curated Soundscapes</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Tap to switch ambient audio backdrop for mindful immersion
            </Text>

            <View style={styles.soundscapeList}>
              {SOUNDSCAPES.map((item, index) => {
                const isSelected = index === selectedTrackIndex;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.soundscapeCard,
                      isSelected && styles.soundscapeCardActive,
                    ]}
                    onPress={() => handleSelectTrack(index)}
                    activeOpacity={0.82}
                  >
                    <View style={[styles.soundscapeIconBox, isSelected && styles.soundscapeIconBoxActive]}>
                      {renderTrackIcon(item.icon, isSelected)}
                    </View>
                    <View style={styles.soundscapeInfo}>
                      <View style={styles.soundscapeTitleRow}>
                        <Text style={[styles.soundscapeTitle, isSelected && styles.soundscapeTitleActive]}>
                          {item.title}
                        </Text>
                        <View style={[styles.soundscapeCategoryPill, isSelected && styles.soundscapeCategoryPillActive]}>
                          <Text style={[styles.soundscapeCategoryText, isSelected && styles.soundscapeCategoryTextActive]}>
                            {item.category}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.soundscapeSubtitle}>{item.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF5F4',
  },
  safeArea: {
    flex: 1,
  },

  // Ambient Translucent Mint-Teal & Soft Sky-Blue Circles (HomeScreen aesthetic)
  ambientOrbTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(45, 212, 191, 0.24)',
  },
  ambientOrbMiddle: {
    position: 'absolute',
    top: 360,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(20, 184, 166, 0.20)',
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: 100,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },

  // Header Bar
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  muteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Duration Preset Pills
  durationPresetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  durationPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  durationPillActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
    shadowColor: '#0D9488',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  durationPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  durationPillTextActive: {
    color: '#FFFFFF',
  },

  // 1. Immersive Visual Sanctuary Video Card
  videoCardContainer: {
    width: '100%',
    height: 195,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
    backgroundColor: '#0F172A',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  nowPlayingBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  nowPlayingLeft: {
    flex: 1,
    marginRight: 12,
  },
  nowPlayingTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  nowPlayingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nowPlayingRight: {
    alignItems: 'flex-end',
  },
  nowPlayingTimer: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
  },

  // Playback Controls Row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  secondaryControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },

  // Soundscape List Section
  soundscapeSection: {
    marginTop: 4,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  soundscapeList: {
    gap: 10,
  },
  soundscapeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  soundscapeCardActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  soundscapeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  soundscapeIconBoxActive: {
    backgroundColor: '#CCFBF1',
  },
  soundscapeInfo: {
    flex: 1,
  },
  soundscapeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  soundscapeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  soundscapeTitleActive: {
    color: '#0D9488',
  },
  soundscapeCategoryPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  soundscapeCategoryPillActive: {
    backgroundColor: '#CCFBF1',
  },
  soundscapeCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  soundscapeCategoryTextActive: {
    color: '#0D9488',
  },
  soundscapeSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
  },
});

export default MeditationScreen;
