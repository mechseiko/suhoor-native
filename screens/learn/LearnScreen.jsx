import React, { useState } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useTheme } from "../../context/ThemeContext"
import { useLanguage } from "../../context/LanguageContext"

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const TOPICS = [
  {
    id: "conditions",
    icon: "shield-checkmark",
    color: "#6366F1",
    titleKey: "learn.topic.conditions",
    subtitleKey: "learn.topic.conditionsSub",
    sections: [
      { heading: "1. Islam", body: "The first requirement is to be Muslim. Those who do not believe in Islam are not obliged to fast." },
      { heading: "2. Puberty", body: "Fasting is mandatory for those who have reached puberty. Children are not obliged but parents should train them from age seven." },
      { heading: "3. Be Sensible", body: "Only mentally sound people are obliged to fast. Mentally ill individuals are not required to fast, per the consensus of the ulama." },
      { heading: "4. Healthy", body: "Sick people are not obliged to fast but must make up the missed days later.", arabic: "\u0648\u064e\u0645\u064e\u0646\u0652 \u0643\u064e\u0627\u0646\u064e \u0645\u064e\u0631\u0650\u064a\u0652\u0636\u064b\u0627 \u0627\u064e\u0648\u0652 \u0639\u064e\u0644\u0670\u0649 \u0633\u064e\u0641\u064e\u0631\u064d \u0641\u064e\u0639\u0650\u062f\u0651\u064e\u0629\u064c \u0645\u0650\u0651\u0646\u0652 \u0627\u064e\u064a\u0651\u064e\u0627\u0645\u064d \u0627\u064e\u062e\u064e\u0631\u064e", arabicTrans: '"And whoever is sick or on a journey, then as many days as he missed on other days." (Al-Baqarah 2:185)' },
      { heading: "5. Capable", body: "Those physically unable to fast (e.g. due to old age) are exempt.", arabic: "\u0648\u064e\u0639\u064e\u0644\u064e\u0649 \u0627\u0644\u0651\u064e\u0630\u0650\u064a\u0652\u0646\u064e \u064a\u064f\u0637\u0650\u064a\u0652\u0642\u064f\u0648\u0646\u064e\u0647\u0697 \u0641\u0650\u062f\u0652\u064a\u064e\u0629\u064c \u0637\u064e\u0639\u064e\u0627\u0645\u064f \u0645\u0650\u0633\u0652\u0643\u0650\u064a\u0652\u0646\u064d", arabicTrans: '"For people who carry it hard, they are obliged to pay fidyah by feeding the poor." (Al-Baqarah 2:184)' },
      { heading: "6. Travelling", body: "A traveller covering approx. 81 km or more for a permissible purpose may choose not to fast, but must make up the days later. A traveller may also choose to continue fasting." },
      { heading: "7. Chaste (Menstruation and Postpartum)", body: "Women who are menstruating or in postpartum (nifas) are not required to fast. They must make up the missed days after recovery, as confirmed in the hadith of Aisha." },
    ],
  },
  {
    id: "duas",
    icon: "hand-left",
    color: "#10B981",
    titleKey: "learn.topic.fastingDuas",
    subtitleKey: "learn.topic.fastingDuasSub",
    sections: [
      { heading: "Intention to Fast on Monday", arabic: "\u0646\u064e\u0648\u064e\u064a\u0652\u062a\u064f \u0635\u064e\u0648\u0652\u0645\u064e \u063a\u064e\u062f\u064d \u0641\u0650\u064a \u064a\u064e\u0648\u0652\u0645\u0650 \u0627\u0644\u0652\u0625\u062b\u0652\u0646\u064e\u064a\u0652\u0646\u0650 \u0633\u064f\u0646\u0651\u064e\u0629\u064b \u0644\u0650\u0644\u0644\u0651\u0670\u0647\u0650 \u062a\u064e\u0639\u064e\u0627\u0644\u064e\u0649", arabicTrans: "Nawaitu sauma gadin fi yaumil-isnaini sunnatal lillahi ta'ala.", body: 'Meaning: "I intend to fast on sunnah Monday because of Allah Ta\'ala."' },
      { heading: "Intention to Fast on Thursday", arabic: "\u0646\u064e\u0648\u064e\u064a\u0652\u062b\u064f \u0635\u064e\u0648\u0652\u0645\u064e \u063a\u064e\u062f\u064d \u0641\u0650\u064a \u064a\u064e\u0648\u0652\u0645\u0650 \u0627\u0644\u0652\u062e\u064e\u0645\u0650\u064a\u0633\u0650 \u0633\u064f\u0646\u0651\u064e\u0629\u064b \u0644\u0650\u0644\u0644\u0651\u0670\u0647\u0650 \u062a\u064e\u0639\u064e\u0627\u0644\u064e\u0649", arabicTrans: "Nawaitu sauma gadin fi yaumil-khamisi sunnatan lillahi ta'ala.", body: 'Meaning: "I intend to fast on sunnah Thursday because of Allah Ta\'ala."' },
      { heading: "Du'a for Breaking the Fast (Iftar)", arabic: "\u0627\u0644\u0644\u0651\u064e\u0647\u064f\u0645\u0651\u064e \u0644\u064e\u0643\u064e \u0635\u064f\u0645\u0652\u062a\u064f \u0648\u064e\u0628\u0650\u0643\u064e \u0622\u0645\u064e\u0646\u0652\u062a\u064f \u0648\u064e\u0639\u064e\u0644\u064e\u0649 \u0631\u0650\u0632\u0652\u0642\u0650\u0643\u064e \u0623\u064e\u0641\u0652\u0637\u064e\u0631\u0652\u062a\u064f \u0628\u0650\u0631\u064e\u062d\u0652\u0645\u064e\u062a\u0650\u0643\u064e \u064a\u064e\u0627 \u0623\u064e\u0631\u0652\u062d\u064e\u0645\u064e \u0627\u0644\u0631\u0651\u064e\u0627\u062d\u0650\u0645\u0650\u064a\u0646\u064e", arabicTrans: "Allahumma laka sumtu wabika aamantu wa'ala rizqika afthortu birohmatika ya arhamar rahimin.", body: 'Meaning: "O Allah, for You I have fasted, in You I believe, and with Your sustenance I break my fast, O Most Merciful of the merciful."' },
    ],
  },
  {
    id: "sunnah",
    icon: "sunny",
    color: "#F59E0B",
    titleKey: "learn.topic.sunnah",
    subtitleKey: "learn.topic.sunnahSub",
    sections: [
      { heading: "1. Having Sahur (Pre-Dawn Meal)", body: "Engaging in Sahur is a rewarding practice in the month of Ramadan, even if it is just a sip of water.", arabic: "\u062a\u064e\u0633\u064e\u062d\u0651\u064e\u0631\u064f\u0648\u0627 \u0641\u064e\u0625\u0650\u0646\u0651\u064e \u0641\u0650\u064a \u0627\u0644\u0633\u0651\u064e\u062d\u064f\u0648\u0631\u0650 \u0628\u064e\u0631\u064e\u0643\u064e\u0629\u064b", arabicTrans: '"Partake in Sahur, for indeed, there is blessing in Sahur." (Narrated by al-Bukhari)' },
      { heading: "2. Hastening to Break the Fast", body: "Hasten in breaking the fast before Maghrib prayer. It is Sunnah to break with dates first, then water if not available.", arabic: "\u0625\u0630\u064e\u0627 \u0643\u064e\u0627\u0646\u064e \u0623\u064e\u062d\u064e\u062f\u064f\u0643\u064f\u0645\u0652 \u0635\u064e\u0627\u0626\u0650\u0645\u064b\u0627\u060c \u0641\u064e\u0644\u0652\u064a\u064f\u0641\u0652\u0637\u0650\u0631\u0652 \u0639\u064e\u0644\u064e\u0649 \u0627\u0644\u062a\u0651\u064e\u0645\u0652\u0631\u0650\u060c \u0641\u064e\u0625\u0650\u0646\u0652 \u0644\u064e\u0645\u0652 \u064a\u064e\u062c\u0650\u062f\u0650 \u0627\u0644\u062a\u0651\u064e\u0645\u0652\u0631\u064e\u060c \u0641\u064e\u0639\u064e\u0644\u064e\u0649 \u0627\u0644\u0652\u0645\u064e\u0627\u0621\u0650", arabicTrans: '"If one of you is fasting, let him break his fast with dates; if not, with water, for water is purifying." (Narrated by Abu Dawud)' },
      { heading: "3. Reciting Du'a When Breaking Fast", body: "Breaking the fast is one of three moments when supplications are never rejected.", arabic: "\u062b\u064e\u0644\u064e\u0627\u062b\u064e\u0629\u064c \u0644\u064e\u0627 \u062a\u064f\u0631\u064e\u062f\u0651\u064f \u062f\u064e\u0639\u0652\u0648\u064e\u062a\u064f\u0647\u064f\u0645\u0652: \u0627\u0644\u0652\u0625\u0650\u0645\u064e\u0627\u0645\u064f \u0627\u0644\u0652\u0639\u064e\u0627\u062f\u0650\u0644\u064f \u0648\u064e\u0627\u0644\u0635\u0651\u064e\u0627\u0626\u0650\u0645\u064f \u062d\u0650\u064a\u0646\u064e \u064a\u064f\u0641\u0652\u0637\u0650\u0631\u064f \u0648\u064e\u062f\u064e\u0639\u0652\u0648\u064e\u0629\u064f \u0627\u0644\u0652\u0645\u064e\u0638\u0652\u0644\u064f\u0648\u0645\u0650", arabicTrans: '"Three supplications are never rejected: the just leader, the fasting person when he breaks his fast, and the oppressed." (Narrated by Tirmidhi)' },
      { heading: "4. Guarding the Tongue", body: "Restrain the tongue from lying, backbiting, and useless speech. These actions can nullify the rewards of fasting." },
      { heading: "5. Increasing Acts of Charity", body: "Strive to increase acts of charity, especially by providing food for breaking the fast.", arabic: "\u0645\u064e\u0646\u0652 \u0641\u064e\u0637\u0651\u064e\u0631\u064e \u0635\u064e\u0627\u0626\u0650\u0645\u064b\u0627\u060c \u0643\u064f\u062a\u0650\u0628\u064e \u0644\u064e\u0647\u064f \u0645\u0650\u062b\u0652\u0644\u064f \u0623\u064e\u062c\u0652\u0631\u0650\u0647\u0650", arabicTrans: '"Whoever feeds a fasting person will have a reward like that person, without any reduction." (Narrated by Ahmad)' },
      { heading: "6. Reading the Quran", body: "Fasting time is opportune for reading the Quran. The Prophet (saw) said: \"Read the Quran once a month.\" (Narrated by Bukhari)" },
    ],
  },
  {
    id: "invalidators",
    icon: "close-circle",
    color: "#EF4444",
    titleKey: "learn.topic.invalidators",
    subtitleKey: "learn.topic.invalidatorsSub",
    sections: [
      { heading: "1. Intentional Ingestion", body: "Anything intentionally ingested (food, drink, medicine) through any opening — mouth, nose, or ears — will invalidate the fast unless it enters unintentionally." },
      { heading: "2. Medication Administered Anally", body: "Medical treatments administered through the rectum (suppositories) or via a urinary catheter can break the fast." },
      { heading: "3. Intentional Vomiting", body: "Unintentional vomiting does not break the fast if nothing is swallowed. Intentional vomiting that involves swallowing renders the fast invalid." },
      { heading: "4. Emission of Semen Upon Skin Contact", body: "Release of semen after skin contact (without intercourse) nullifies the fast. Discharge due to a wet dream does not break the fast." },
      { heading: "5. Sexual Relations", body: "Sexual intercourse during fasting invalidates the fast and incurs sin. The penalty: fast 60 consecutive days or feed 60 poor individuals." },
      { heading: "6. Menstruation or Postpartum Bleeding", body: "These discharge types break the fast and the days must be made up later." },
      { heading: "7. Mental Disorders", body: "Mental disorders (junun) arising during fasting invalidate it. The missed days must be made up upon recovery." },
      { heading: "8. Leaving Islam (Apostasy)", body: "Apostasy nullifies the fast. The person must make up the fast and recite the shahadah again to return to Islam." },
    ],
  },
  {
    id: "benefits",
    icon: "heart",
    color: "#8B5CF6",
    titleKey: "learn.topic.benefits",
    subtitleKey: "learn.topic.benefitsSub",
    sections: [
      { heading: "1. Self-Purification", body: "Through the effort to perfect the devotion of fasting, a purification within oneself is achieved. Fasting is an act of worship known only to Allah and the individual." },
      { heading: "2. Attaining Taqwa (Piety)", body: "Ibn Qayyim stated: 'Fasting provides extraordinary protection for the body and inner strength.'", arabic: "\u064a\u064e\u0627 \u0623\u064e\u064a\u0651\u064f\u0647\u064e\u0627 \u0627\u0644\u0651\u064e\u0630\u0650\u064a\u0646\u064e \u0622\u0645\u064e\u0646\u064f\u0648\u0627 \u0643\u064f\u062a\u0650\u0628\u064e \u0639\u064e\u0644\u064e\u064a\u0652\u0643\u064f\u0645\u064f \u0627\u0644\u0635\u0651\u0650\u064a\u064e\u0627\u0645\u064f \u0643\u064e\u0645\u064e\u0627 \u0643\u064f\u062a\u0650\u0628\u064e \u0639\u064e\u0644\u064e\u0649 \u0627\u0644\u0651\u064e\u0630\u0650\u064a\u0646\u064e \u0645\u0650\u0646 \u0642\u064e\u0628\u0652\u0644\u0650\u0643\u064f\u0645\u0652 \u0644\u064e\u0639\u064e\u0644\u0651\u064e\u0643\u064f\u0645\u0652 \u062a\u064e\u062a\u0651\u064e\u0642\u064f\u0648\u0646\u064e", arabicTrans: '"O you who believe, fasting has been prescribed for you as it was prescribed for those before you that you may become righteous." (Al-Baqarah 2:183)' },
      { heading: "3. Self-Education", body: "Fasting trains patience and self-control. The Prophet (saw) likened fasting to a shield." },
      { heading: "4. Controlling Desires", body: "The Prophet (saw) recommended fasting to young people unable to marry, as it suppresses desires when the intention is sincere." },
      { heading: "5. Teaching Gratitude", body: "Through fasting, individuals are reminded to appreciate blessings — one truly appreciates fullness only when hungry." },
      { heading: "6. Social Wisdom", body: "Fasting nurtures compassion and empathy towards the poor, as Ibn Qayyim said: 'Fasting reminds us of the hunger experienced by the poor.'" },
      { heading: "7. Maintaining Body Health", body: "Studies show that after initial adjustment, the fasting body becomes fresh and healthy as toxins are naturally cleansed. Fasting is effective in healing various illnesses." },
    ],
  },
  {
    id: "diminish",
    icon: "warning",
    color: "#F97316",
    titleKey: "learn.topic.diminish",
    subtitleKey: "learn.topic.diminishSub",
    sections: [
      { heading: "1. Lying or Deceit", body: 'The Prophet (saw) said: "Whoever does not abandon false speech and acting upon it, Allah has no need for him to abandon his food and drink." (Bukhari-Muslim)' },
      { heading: "2. Abusive Language and Harsh Speech", body: 'The Prophet (saw) said: "If someone mocks or behaves harshly towards you, say: I am fasting." (Narrated by Bukhari)' },
      { heading: "3. Gossiping", body: "Gossiping is likened in the Quran (49:12) to eating the flesh of one\'s dead brother.", arabic: "\u062e\u0645\u0633 \u064a\u064f\u0641\u0637\u0650\u0631\u0646 \u0627\u0644\u0635\u0627\u0626\u0650\u0645\u064e: \u0627\u0644\u063a\u0650\u064a\u0628\u064e\u0629\u064f\u060c \u0648\u0627\u0644\u0646\u0651\u064e\u0645\u064a\u0645\u064e\u0629\u064f\u060c \u0648\u0627\u0644\u0643\u0650\u0630\u0628\u064f\u060c \u0648\u0627\u0644\u0646\u0651\u064e\u0638\u0631\u064f \u0628\u0650\u0627\u0644\u0634\u0651\u064e\u0647\u0648\u064e\u0629\u0650\u060c \u0648\u0627\u0644\u064a\u064e\u0645\u0650\u064a\u0646\u064f \u0627\u0644\u0643\u064e\u0627\u0630\u0650\u0628\u064e\u0629\u064f", arabicTrans: '"Five things break the fast: gossiping, spreading discord, lying, looking with lust, and false oaths." (Narrated by Ad-Dailami)' },
      { heading: "4. Excessive Sleep", body: "Spending the entire fasting day sleeping contradicts the Prophetic example. Sleep is allowed in moderation but regular activities should continue." },
      { heading: "5. Excessive Eating at Suhoor and Iftar", body: "The Prophet (saw) taught not to overindulge. Eat in moderation and choose nutritious food — fasting is also about disciplining the body." },
      { heading: "6. Showing Off (Riya')", body: "Fasting for praise from others nullifies rewards.", arabic: "\u0648\u0645\u064e\u0646\u0652 \u0635\u064e\u0627\u0645\u064e \u064a\u064f\u0631\u064e\u0627\u0626\u0650\u064a \u0641\u0642\u064e\u062f\u0652 \u0623\u0634\u0631\u064e\u0643\u064e", arabicTrans: '"Whoever fasts while showing off has committed shirk." (Narrated by Ahmad, Tirmidhi, Ibn Majah, and Thabrani)' },
      { heading: "7. Breaking Fast with Haram Food", body: "Breaking the fast with stolen or forbidden food nullifies its rewards and makes a person lazy in worship." },
      { heading: "8. Hugging and Kissing Spouse", body: "Physical affection between spouses during fasting is disliked (makruh) as it may encourage lust. Couples should refrain until after breaking the fast." },
    ],
  },
]

const SectionItem = ({ section, colors }) => (
  <View style={[styles.sectionItem, { borderLeftColor: colors.primary + "55" }]}>
    {section.heading ? <Text style={[styles.sectionHeading, { color: colors.text }]}>{section.heading}</Text> : null}
    {section.arabic ? (
      <View style={[styles.arabicBox, { backgroundColor: colors.surfaceVariant }]}>
        <Text style={[styles.arabicText, { color: colors.text }]}>{section.arabic}</Text>
        {section.arabicTrans ? <Text style={[styles.arabicTrans, { color: colors.textSecondary }]}>{section.arabicTrans}</Text> : null}
      </View>
    ) : null}
    {section.body ? <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{section.body}</Text> : null}
  </View>
)

const TopicCard = ({ topic, colors, t }) => {
  const [expanded, setExpanded] = useState(false)
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded((prev) => !prev)
  }
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: expanded ? topic.color + "55" : colors.border, borderWidth: expanded ? 1.5 : 1 }]}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.75} style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: topic.color + "18" }]}>
          <Ionicons name={topic.icon} size={22} color={topic.color} />
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t(topic.titleKey, topic.titleKey)}</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{t(topic.subtitleKey, topic.subtitleKey)}</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={expanded ? topic.color : colors.textSecondary} />
      </TouchableOpacity>
      {expanded && <View style={[styles.accentBar, { backgroundColor: topic.color }]} />}
      {expanded && (
        <View style={styles.cardBody}>
          {topic.sections.map((sec, i) => (
            <SectionItem key={i} section={sec} colors={colors} />
          ))}
        </View>
      )}
    </View>
  )
}

export const LearnScreen = () => {
  const { colors } = useTheme()
  const { t } = useLanguage()
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.intro}>
        <Text style={[styles.introText, { color: colors.textSecondary }]}>
          {t("learn.subtitle", "Essential knowledge about fasting in Islam")}
        </Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {TOPICS.map((topic) => (
          <TopicCard key={topic.id} topic={topic} colors={colors} t={t} />
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  introText: { fontSize: 13.5, lineHeight: 19 },
  listContent: { paddingHorizontal: 12, paddingVertical: 8 },
  card: { borderRadius: 16, marginBottom: 12, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 16, columnGap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  cardSub: { fontSize: 12, lineHeight: 16 },
  accentBar: { height: 2, marginHorizontal: 16, borderRadius: 1, marginBottom: 4 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionItem: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 14 },
  sectionHeading: { fontSize: 13.5, fontWeight: "700", marginBottom: 6 },
  sectionBody: { fontSize: 13, lineHeight: 20 },
  arabicBox: { borderRadius: 10, padding: 12, marginBottom: 8 },
  arabicText: { fontSize: 20, lineHeight: 34, textAlign: "right", fontWeight: "500" },
  arabicTrans: { fontSize: 12, lineHeight: 18, fontStyle: "italic", textAlign: "right", marginTop: 4 },
})

export default LearnScreen
