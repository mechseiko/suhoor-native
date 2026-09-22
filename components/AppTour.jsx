import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const TOUR_STEPS = [
  {
    id: 'homescreen',
    title: 'yourHomeScreen',
    description: 'tour.homeDescription',
    position: { x: width / 2, y: height / 3 },
  },
  {
    id: 'fasting',
    title: 'fastingTimes',
    description: 'tour.fastingDescription',
    position: { x: width / 2, y: height / 2 },
  },
  {
    id: 'groups',
    title: 'groups',
    description: 'tour.groupsDescription',
    position: { x: width / 2, y: height * 0.6 },
  },
];

export const AppTour = ({ children }) => {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const spotlightAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkTourStatus();
  }, []);

  const checkTourStatus = async () => {
    try {
      const hasSeenTour = await AsyncStorage.getItem('hasSeenAppTour');
      if (!hasSeenTour) {
        setVisible(true);
        animateEntry();
      }
    } catch (error) {
      console.error('Error checking tour status:', error);
    }
  };

  const animateEntry = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateSpotlight = (toX, toY) => {
    Animated.spring(spotlightAnim, {
      toValue: 1,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start(() => {
      spotlightAnim.setValue(0);
    });
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      animateSpotlight(
        TOUR_STEPS[currentStep + 1].position.x,
        TOUR_STEPS[currentStep + 1].position.y
      );
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem('hasSeenAppTour', 'true');
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
      });
    } catch (error) {
      console.error('Error saving tour status:', error);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!visible) {
    return <>{children}</>;
  }

  const step = TOUR_STEPS[currentStep];
  const spotlightSize = 200;

  return (
    <>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <StatusBar backgroundColor="transparent" barStyle="light-content" />
        
        {/* Dark overlay with spotlight hole */}
        <View style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                opacity: overlayOpacity,
              },
            ]}
          >
            {/* Spotlight circle */}
            <Animated.View
              style={[
                styles.spotlight,
                {
                  left: step.position.x - spotlightSize / 2,
                  top: step.position.y - spotlightSize / 2,
                  width: spotlightSize,
                  height: spotlightSize,
                  borderRadius: spotlightSize / 2,
                  backgroundColor: 'transparent',
                  borderWidth: 3,
                  borderColor: colors.primary,
                  transform: [
                    {
                      scale: spotlightAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    },
                  ],
                },
              ]}
            />
          </Animated.View>
        </View>

        {/* Tour content */}
        <SafeAreaView style={StyleSheet.absoluteFill}>
          <View style={styles.contentContainer}>
            {/* Skip button */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipText}>{t('common.skip')}</Text>
            </TouchableOpacity>

            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              {TOUR_STEPS.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: index === currentStep ? colors.primary : 'rgba(255, 255, 255, 0.3)',
                      width: index === currentStep ? 24 : 8,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Tour text */}
            <Animated.View
              style={[
                styles.textContainer,
                {
                  opacity: textOpacity,
                  top: step.position.y + spotlightSize / 2 + 40,
                },
              ]}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name={
                    step.id === 'homescreen'
                      ? 'home-outline'
                      : step.id === 'fasting'
                      ? 'time-outline'
                      : 'people-outline'
                  }
                  size={48}
                  color={colors.primary}
                />
              </View>
              
              <Text style={[styles.title, { color: colors.text }]}>
                {t(step.title)}
              </Text>
              
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {t(step.description)}
              </Text>

              {/* Navigation buttons */}
              <View style={styles.buttonContainer}>
                {currentStep > 0 && (
                  <TouchableOpacity
                    style={[styles.button, styles.backButton]}
                    onPress={() => setCurrentStep(currentStep - 1)}
                  >
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                    <Text style={[styles.buttonText, { color: colors.text }]}>
                      {t('common.back')}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.button, styles.nextButton, { backgroundColor: colors.primary }]}
                  onPress={handleNext}
                >
                  <Text style={styles.nextButtonText}>
                    {currentStep === TOUR_STEPS.length - 1 ? t('common.finish') : t('common.next')}
                  </Text>
                  <Ionicons
                    name={currentStep === TOUR_STEPS.length - 1 ? 'checkmark' : 'arrow-forward'}
                    size={20}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  spotlight: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  stepDot: {
    height: 8,
    borderRadius: 4,
  },
  textContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AppTour;