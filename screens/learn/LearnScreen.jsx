import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Modal,
  Linking,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getLearnSections } from "../../content/learn";

const TOPICS = [
  {
    id: "howItWorks",
    icon: "compass-outline",
    color: "#F59E0B",
    titleKey: "learn.topic.howItWorks",
    titleDefault: "How Suhoor Works",
    subtitleKey: "learn.topic.howItWorksSub",
    subtitleDefault: "Everything you need to know about how Suhoor works",
    isTourTrigger: true
  },
  {
    id: "duas",
    icon: "hand-left",
    color: "#10B981",
    titleKey: "learn.topic.fastingDuas",
    titleDefault: "Fasting Supplication (Duas)",
    subtitleKey: "learn.topic.fastingDuasSub",
    subtitleDefault: "Interactive collection of authenticated duas and supplications",
    isInteractiveDuas: true
  },
  {
    id: "books",
    icon: "book",
    color: "#8B5CF6",
    titleKey: "learn.topic.books",
    titleDefault: "Books",
    subtitleKey: "learn.topic.booksSub",
    subtitleDefault: "Authentic books on fasting and spirituality",
    isBooks: true
  },
  {
    id: "conditions",
    icon: "shield-checkmark",
    color: "#6366F1",
    titleKey: "learn.topic.conditions",
    titleDefault: "Conditions for Fasting",
    subtitleKey: "learn.topic.conditionsSub",
    subtitleDefault: "Requirements and prerequisites for observing the fast"
  },
  {
    id: "sunnah",
    icon: "sunny",
    color: "#F59E0B",
    titleKey: "learn.topic.sunnah",
    titleDefault: "Sunnah Practices",
    subtitleKey: "learn.topic.sunnahSub",
    subtitleDefault: "Recommended habits and actions to multiply your fasting reward"
  },
  {
    id: "invalidators",
    icon: "close-circle",
    color: "#EF4444",
    titleKey: "learn.topic.invalidators",
    titleDefault: "Fasting Invalidator",
    subtitleKey: "learn.topic.invalidatorsSub",
    subtitleDefault: "Actions and circumstances that break or void the fast"
  },
  {
    id: "benefits",
    icon: "heart",
    color: "#8B5CF6",
    titleKey: "learn.topic.benefits",
    titleDefault: "Benefits of Fasting",
    subtitleKey: "learn.topic.benefitsSub",
    subtitleDefault: "Spiritual, psychological, and physical wisdom behind fasting"
  },
  {
    id: "diminish",
    icon: "warning",
    color: "#F97316",
    titleKey: "learn.topic.diminish",
    titleDefault: "Things that Diminish Rewards",
    subtitleKey: "learn.topic.diminishSub",
    subtitleDefault: "Behaviors that erode the spiritual blessings of your fast"
  }
];

export const LearnScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { t, locale } = useLanguage();
  const [selectedTopic, setSelectedTopic] = useState(null);

  const handleCardPress = (topic) => {
    if (topic.isTourTrigger) {
      Linking.openURL('https://suhoorapp.cv/howitworks');
    } else if (topic.isInteractiveDuas) {
      navigation.navigate("Duas");
    } else if (topic.isBooks) {
      navigation.navigate("Books");
    } else {
      setSelectedTopic(topic);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.intro}>
        <Text style={[styles.introText, { color: colors.textSecondary }]}>
          {t("learn.subtitle", "Essential knowledge and supplications about fasting in Islam")}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridContainer}>
          {TOPICS.map((topic) => {
            const title = t(topic.titleKey, topic.titleDefault);
            const subtitle = t(topic.subtitleKey, topic.subtitleDefault);

            return (
              <TouchableOpacity
                key={topic.id}
                activeOpacity={0.75}
                onPress={() => handleCardPress(topic)}
                style={[
                  styles.gridCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.gridIconWrap,
                    { backgroundColor: topic.color + "18" },
                  ]}
                >
                  <Ionicons name={topic.icon} size={26} color={topic.color} />
                </View>

                <View style={{ flex: 1, justifyContent: "space-between" }}>
                  <Text style={[styles.gridCardTitle, { color: colors.text }]} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text
                    style={[styles.gridCardSub, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Bottom Popup Modal (Matching the notification modal on HomeScreen) */}
      <Modal
        visible={selectedTopic !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedTopic(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setSelectedTopic(null)}
          />

          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface || "#FFFFFF" },
            ]}
          >
            {/* Modal Header */}
            {selectedTopic && (
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border || "#F3F4F6" },
                ]}
              >
                <View style={styles.modalHeaderLeft}>
                  <View
                    style={[
                      styles.modalIconWrap,
                      { backgroundColor: selectedTopic.color + "18" },
                    ]}
                  >
                    <Ionicons
                      name={selectedTopic.icon}
                      size={20}
                      color={selectedTopic.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.modalTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {t(selectedTopic.titleKey, selectedTopic.titleDefault)}
                    </Text>
                    <Text
                      style={[styles.modalSub, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {t(selectedTopic.subtitleKey, selectedTopic.subtitleDefault)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedTopic(null)}
                  hitSlop={10}
                  style={[
                    styles.closeBtn,
                    { backgroundColor: colors.surfaceVariant || "#F3F4F6" },
                  ]}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}

            {/* Modal Scrollable Content */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={true}
            >
              {getLearnSections(selectedTopic?.id, locale).map((sec, i) => (
                <View
                  key={i}
                  style={styles.sectionBlock}
                >
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    {sec.heading}
                  </Text>
                  <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
                    {sec.body}
                  </Text>
                  {sec.arabic && (
                    <Text style={[styles.arabicText, { color: colors.text }]}>
                      {sec.arabic}
                    </Text>
                  )}
                  {sec.arabicTrans && (
                    <Text style={[styles.arabicTrans, { color: colors.textSecondary }]}>
                      {sec.arabicTrans}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  intro: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  gridCard: {
    width: "48%",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 160,
  },
  gridIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  gridCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  gridCardSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardTitleWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  modalSub: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: 20,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  arabicText: {
    fontSize: 18,
    textAlign: "right",
    marginBottom: 6,
    fontFamily: "System",
  },
  arabicTrans: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
});

export default LearnScreen;