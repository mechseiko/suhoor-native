import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

const TOPICS = [
  {
    id: "conditions",
    icon: "shield-checkmark",
    color: "#6366F1",
    titleKey: "learn.topic.conditions",
    titleDefault: "Conditions for Fasting",
    subtitleKey: "learn.topic.conditionsSub",
    subtitleDefault: "Requirements and prerequisites for observing the fast",
    sections: [
      {
        heading: "1. Islam",
        body: "The first requirement is to be Muslim. Therefore, those who do not believe in Islam are not obliged to fast.",
      },
      {
        heading: "2. Puberty",
        body: "Second, the mandatory requirement for fasting is for those who are of puberty. Small children are not obliged to observe obligatory fasts, however, their parents are obliged to train them to observe fasts from the age of seven.",
      },
      {
        heading: "3. Be sensible",
        body: "The next condition is to be sensible. What this means is that only sensible people are obliged to fast. According to the consensus of the ulama, mentally ill people are people who are not rational, so they are not obliged to fast.",
      },
      {
        heading: "4. Healthy",
        body: "Sick people do not have the obligation to carry out mandatory fasting such as Ramadan. However, he had to replace it another day. This is in accordance with the word of Allah in surah Al Baqarah verse 185:",
        arabic: "وَمَنْ كَانَ مَرِيْضًا اَوْ عَلٰى سَفَرٍ فَعِدَّةٌ مِّنْ اَيَّامٍ اَخَرَ",
        arabicTrans: '"...And whoever is sick or on a journey (he does not fast), then (must make up for it), as many days as he missed, on other days..."',
      },
      {
        heading: "5. Capable",
        body: "Furthermore, the condition for fasting is being able. The meaning is that it is mandatory for those who do it. For those who are physically weak due to age or it is not possible to fast, they are not obliged to fast. This is also in accordance with the word of Allah in Surah Al Baqarah verse 184:",
        arabic: "وَعَلَى الَّذِيْنَ يُطِيْقُوْنَهٗ فِدْيَةٌ طَعَامُ مِسْكِيْنٍ",
        arabicTrans: '"...And for people who carry it hard, they are obliged to pay fidyah, namely feeding the poor..."',
      },
      {
        heading: "6. Traveling",
        body: "Based on Al Baqarah verse 185 above (on point 4) it is permissible for those who are on journey or travelling not to fast. However, according to the opinion of scholars, not all types of travel allow someone not to fast. Some conditions are:\n\n• The journey undertaken must cover a distance that permits the shortening of prayers (qashar salat) — approximately 81 kilometers.\n• The journey undertaken should be permissible, not for the purpose of committing sin.\n• The journey should commence during the night, and before the break of dawn (subuh).\n• If the journey begins after the break of dawn, the individual cannot be considered a traveler, and they are not allowed to break their fast.\n• A traveler is also allowed to continue fasting if capable.",
      },
      {
        heading: "7. Chaste and Menstruation and Postpartum",
        body: "According to the consensus of the ulama, women who are menstruating or postpartum are not required to fast. The basis is based on the hadith narrated by Aisyah that: 'We (menstruating or postpartum women) are ordered to make up for fasting and are not ordered to make up for prayers.'",
      },
    ],
  },
  {
    id: "duas",
    icon: "hand-left",
    color: "#10B981",
    titleKey: "learn.topic.fastingDuas",
    titleDefault: "Fasting Supplication (Duas)",
    subtitleKey: "learn.topic.fastingDuasSub",
    subtitleDefault: "Interactive collection of authenticated duas and supplications",
    isInteractiveDuas: true,
  },
  {
    id: "sunnah",
    icon: "sunny",
    color: "#F59E0B",
    titleKey: "learn.topic.sunnah",
    titleDefault: "Sunnah Practices",
    subtitleKey: "learn.topic.sunnahSub",
    subtitleDefault: "Recommended habits and actions to multiply your fasting reward",
    sections: [
      {
        heading: "1. Having Sahur (Pre-Dawn Meal)",
        body: "Engaging in Sahur is a rewarding practice in the month of Ramadan, even if it's just a sip of water, as advised by the Prophet Muhammad (peace be upon him):",
        arabic: "تَسَحَّرُوا فَإِنَّ فِي السَّحُورِ بَرَكَةً",
        arabicTrans: '"Partake in Sahur, for indeed, there is blessing in Sahur." (Narrated by al-Bukhari)',
      },
      {
        heading: "2. Hastening to Break the Fast",
        body: "Another practice is to hasten in breaking the fast before the Maghrib prayer. When breaking the fast initially, it is Sunnah to do so with dates. If not available, then with water:",
        arabic: "إِذَا كَانَ أَحَدُكُمْ صَائِمًا، فَلْيُفْطِرْ عَلَى التَّمْرِ، فَإِنْ لَمْ يَجِدِ التَّمْرَ، فَعَلَى الْمَاءِ فَإِنَّ الْمَاءَ طَهُورٌ",
        arabicTrans: '"If one of you is fasting, let him break his fast with dates. If he does not have dates, then with water, for indeed, water is purifying." (Narrated by Abu Dawud)',
      },
      {
        heading: "3. Reciting the Du'a for Breaking the Fast",
        body: "When breaking the fast, it is recommended to recite the du'a for breaking the fast as a gesture of gratitude. Breaking the fast is also an opportune moment for supplication:",
        arabic: "اللَّهُمَّ لَكَ صُمْتُ وَبِكَ آمَنْتُ وَعَلَى رِزْقِكَ أَفْطَرْتُ بِرَحْمَتِكَ يَا أَرْحَمَ الرَّاحِمِينَ",
        arabicTrans: '"Allahumma laka sumtu wa bika aamantu wa \'ala rizqika afthortu birohmatika ya arhamar rahimin"\nMeaning: "O Allah, for You, I have fasted, and in You, I believe, and with Your sustenance, I break my fast, O Most Merciful of the merciful."',
      },
      {
        heading: "4. Guarding the Tongue",
        body: "It is crucial to restrain the tongue from useless or forbidden speech, such as lying and backbiting, as these actions can nullify the rewards of fasting.",
      },
      {
        heading: "5. Increasing Acts of Charity",
        body: "Those who fast should strive to increase acts of charity towards others, especially by providing food or drinks for breaking the fast:",
        arabic: "مَنْ فَطَّرَ صَائِمًا، كُتِبَ لَهُ مِثْلُ أَجْرِهِ، إِلَّا أَنَّهُ لَا يَنْقُصُ مِنْ أَجْرِ الصَّائِمِ شَيْءٌ",
        arabicTrans: '"Whoever feeds a fasting person will have a reward like that of the fasting person, without any reduction in his reward." (Narrated by Ahmad)',
      },
      {
        heading: "6. Reading the Quran",
        body: "Fasting time is opportune for reading and studying the Quran. As conveyed by the Prophet Muhammad (peace be upon him) to Abdullah bin Amru, 'Read (complete) the Quran once a month.' (Narrated by Bukhari)",
      },
    ],
  },
  {
    id: "invalidators",
    icon: "close-circle",
    color: "#EF4444",
    titleKey: "learn.topic.invalidators",
    titleDefault: "Fasting Invalidator",
    subtitleKey: "learn.topic.invalidatorsSub",
    subtitleDefault: "Actions and circumstances that break or void the fast",
    sections: [
      {
        heading: "1. Intentional ingestion of substances",
        body: "During fasting, a true Muslim should not intentionally introduce anything into the body through any opening, such as the mouth, nose, or ears. Anything intentionally ingested invalidates the fast unless it enters unintentionally.",
      },
      {
        heading: "2. Medication administered anally",
        body: "Medical treatments administered through the rectum, either through the back or front opening, can also break the fast. Individuals who need to use a urinary catheter cannot continue fasting as it invalidates obligatory worship.",
      },
      {
        heading: "3. Intentional vomiting",
        body: "If someone vomits suddenly and unintentionally, the fast remains valid, provided that none of the vomited matter is swallowed. However, intentional vomiting that involves swallowing part of the vomit renders the fast invalid.",
      },
      {
        heading: "4. Emission of semen upon skin contact",
        body: "The release of semen after skin contact, even without sexual intercourse, nullifies the fast. However, if semen is discharged due to a wet dream (ihtilam) or in an unconscious state, the fast remains valid.",
      },
      {
        heading: "5. Sexual relations",
        body: "Engaging in sexual intercourse during fasting invalidates the fast and incurs severe expiation: fasting consecutively for two lunar months or feeding 60 poor individuals.",
      },
      {
        heading: "6. Menstruation",
        body: "Menstruation or postpartum bleeding (nifas) breaks the fast immediately. Women experiencing this must make up for the missed fasting days later.",
      },
      {
        heading: "7. Mental disorders",
        body: "Mental disorders (junun) that arise during fasting invalidate the fast. Those experiencing this condition must make up for missed days once recovered.",
      },
      {
        heading: "8. Leaving Islam",
        body: "Apostasy (murtad) nullifies the fast immediately. In such cases, the person must return to Islam with the declaration of faith (shahadah) and make up the missed fasts.",
      },
    ],
  },
  {
    id: "benefits",
    icon: "heart",
    color: "#8B5CF6",
    titleKey: "learn.topic.benefits",
    titleDefault: "Benefits of Fasting",
    subtitleKey: "learn.topic.benefitsSub",
    subtitleDefault: "Spiritual, psychological, and physical wisdom behind fasting",
    sections: [
      {
        heading: "1. Self-Purification",
        body: "Fasting is an act of obedience to what Allah SWT has prescribed, involving abstaining from prohibitions. Since fasting is known only to Allah and the individual, people restrain desires purely seeking Allah's pleasure.",
      },
      {
        heading: "2. Attaining the Rank of Taqwa (Piety)",
        body: "Fasting has the potential to elevate the practitioner to the level of piety. As Allah states in Surah Al-Baqarah verse 183:",
        arabic: "يَا أَيُّهَا الَّذِينَ آمَنُوا كُتِبَ عَلَيْكُمُ الصِّيَامُ كَمَا كُتِبَ عَلَى الَّذِينَ مِن قَبْلِكُمْ لَعَلَّكُمْ تَتَّقُونَ",
        arabicTrans: '"O you who have believed, decreed upon you is fasting as it was decreed upon those before you that you may become righteous."',
      },
      {
        heading: "3. Self-Education Process",
        body: "Through fasting, an individual is trained to cultivate patience and control habits. Prophet Muhammad likened fasting to a shield: 'Fasting is a shield, so do not speak obscenely or behave ignorantly.'",
      },
      {
        heading: "4. Training to Control Desires",
        body: "Fasting has a significant influence in restraining one's physical desires, especially when done with sincere intention of seeking Allah's pleasure.",
      },
      {
        heading: "5. Teaching Gratitude for Blessings",
        body: "Through fasting, individuals are reminded to appreciate blessings — one truly appreciates fullness and water only after thirst and hunger.",
      },
      {
        heading: "6. Social Wisdom",
        body: "By abstaining from desires throughout the day, fasting nurtures compassion and empathy towards fellow human beings, especially the poor and hungry.",
      },
      {
        heading: "7. Maintaining Body Health",
        body: "Numerous studies indicate that fasting cleanses bodily toxins naturally. The body adapts and heals, improving digestive, cardiovascular, and metabolic health.",
      },
    ],
  },
  {
    id: "diminish",
    icon: "warning",
    color: "#F97316",
    titleKey: "learn.topic.diminish",
    titleDefault: "Things that Diminish Rewards",
    subtitleKey: "learn.topic.diminishSub",
    subtitleDefault: "Behaviors that erode the spiritual blessings of your fast",
    sections: [
      {
        heading: "1. Lying or Deceit",
        body: "Prophet Muhammad (peace be upon him) said: 'Whoever does not abandon false speech and acting upon it, Allah has no need for him to abandon his food and drink.' (Narrated by Bukhari-Muslim)",
      },
      {
        heading: "2. Using Abusive Language and Speaking Harshly",
        body: "Prophet Muhammad emphasized that fasting is refraining from useless words and actions. If someone mocks you, say: 'I am fasting.'",
      },
      {
        heading: "3. Gossiping",
        body: "Gossiping and spreading discord are destructive actions that nullify rewards:",
        arabic: "خمس يُفطِرن الصائِمَ: الغِيبةُ، والنَّميمةُ، والكِذبُ، والنَّظرُ بِالشَّهوةِ، واليمينُ الكاذِبةُ",
        arabicTrans: '"Five things break the reward of the fast: gossiping, spreading discord, lying, lustful gazes, and false oaths." (Narrated by Ad-Dailami)',
      },
      {
        heading: "4. Excessive Sleep",
        body: "Spending the entire fasting period sleeping contradicts the actions of the Prophet. Sleep is allowed in moderation, but continue with productive daily worship and regular activities.",
      },
      {
        heading: "5. Excessive Eating during Suhoor and Iftar",
        body: "Prophet Muhammad taught not to overindulge. Consuming excess food harms health and contradicts the spiritual discipline of fasting. Eat in moderation.",
      },
      {
        heading: "6. Showing Off (Riya')",
        body: "Fasting with the intention of seeking praise from others nullifies its spiritual rewards:",
        arabic: "ومَنْ صَامَ يُرائِي فقَدْ أشرَكَ",
        arabicTrans: '"Whoever fasts while showing off, he has committed shirk (associating partners with Allah)." (Narrated by Ahmad, Tirmidhi)',
      },
      {
        heading: "7. Breaking the Fast with Haram Food",
        body: "Breaking the fast with forbidden or impure food eliminates its rewards and breeds lethargy in worship.",
      },
      {
        heading: "8. Hugging and Kissing Spouse",
        body: "Physical affection between spouses during the fasting period is disliked (makruh) if it risks awakening desire. Couples should wait until after iftar.",
      },
    ],
  },
];

export const LearnScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [selectedTopic, setSelectedTopic] = useState(null);

  const handleCardPress = (topic) => {
    if (topic.isInteractiveDuas) {
      navigation.navigate("Duas");
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
        {TOPICS.map((topic) => {
          const title = t(topic.titleKey, topic.titleDefault);
          const subtitle = t(topic.subtitleKey, topic.subtitleDefault);

          return (
            <TouchableOpacity
              key={topic.id}
              activeOpacity={0.75}
              onPress={() => handleCardPress(topic)}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: topic.color + "18" },
                ]}
              >
                <Ionicons name={topic.icon} size={22} color={topic.color} />
              </View>

              <View style={styles.cardTitleWrap}>
                <View style={styles.titleRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {title}
                  </Text>
                  {topic.isInteractiveDuas && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: topic.color + "18" },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: topic.color }]}>
                        Interactive
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.cardSub, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {subtitle}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          );
        })}
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
              {selectedTopic?.sections?.map((sec, i) => (
                <View
                  key={i}
                  style={[
                    styles.sectionItem,
                    { borderLeftColor: (selectedTopic.color || colors.primary) + "66" },
                  ]}
                >
                  {sec.heading ? (
                    <Text
                      style={[
                        styles.sectionHeading,
                        { color: selectedTopic.color || colors.primary },
                      ]}
                    >
                      {sec.heading}
                    </Text>
                  ) : null}

                  {sec.arabic ? (
                    <View
                      style={[
                        styles.arabicBox,
                        { backgroundColor: colors.surfaceVariant || "#F9FAFB" },
                      ]}
                    >
                      <Text
                        style={[styles.arabicText, { color: colors.text }]}
                      >
                        {sec.arabic}
                      </Text>
                      {sec.arabicTrans ? (
                        <Text
                          style={[
                            styles.arabicTrans,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {sec.arabicTrans}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {sec.body ? (
                    <Text
                      style={[styles.sectionBody, { color: colors.text }]}
                    >
                      {sec.body}
                    </Text>
                  ) : null}
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  introText: { fontSize: 13.5, lineHeight: 19 },
  listContent: { paddingHorizontal: 14, paddingVertical: 6 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    columnGap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleWrap: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardSub: { fontSize: 12, lineHeight: 16 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    flex: 1,
    marginRight: 10,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  modalSub: {
    fontSize: 11.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sectionItem: {
    borderLeftWidth: 3,
    paddingLeft: 14,
    marginTop: 18,
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 13.5,
    lineHeight: 21,
  },
  arabicBox: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  arabicText: {
    fontSize: 19,
    lineHeight: 34,
    textAlign: "right",
    fontWeight: "600",
  },
  arabicTrans: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: "italic",
    textAlign: "left",
    marginTop: 8,
  },
});

export default LearnScreen;
