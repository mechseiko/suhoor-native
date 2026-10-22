import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  TextInput,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { Linking } from "react-native";

const WEB_BASE_URL = "https://suhoor-group.web.app";

const BOOKS = [
  {
    title: "Book of Fasting",
    subtitle: "As-Siyaam wa Ahkaamuhu",
    author: "Shaikh Usaamah Al-Qoosee",
    file: "book-of-fasting.pdf",
    description:
      "A comprehensive translation of a small pocket-size booklet covering the essential rulings, conditions, and etiquette of Islamic fasting.",
    pages: 32,
    category: "Fiqh of Fasting",
  },
  {
    title: "Ramadhan: Let's Avoid the Losses",
    subtitle: "Maximizing the Holy Month",
    author: "Islamic Research Foundation",
    file: "ramadhan-avoid-losses.pdf",
    description:
      "A practical guide identifying common traps and wasted moments in Ramadan, helping you protect your spiritual rewards.",
    pages: 40,
    category: "Spiritual Growth",
  },
  {
    title: "A Guide For Ramadhan",
    subtitle: "Productivity & Planning",
    author: "Darussalam Publications",
    file: "a-guide-for-ramadhan.pdf",
    description:
      "A structured handbook to help Muslims plan their daily schedule, Quran recitation goals, and voluntary prayers throughout Ramadan.",
    pages: 21,
    category: "Productivity",
  },
  {
    title: "Kitab Us-Sawm",
    subtitle: "The Classic Book of Fasting",
    author: "Mujlisul Ulama (PE)",
    file: "kitaabus-sawm.pdf",
    description:
      "Detailed theological exposition on the inner and outer dimensions of fasting, exemptions, and making up missed fasts.",
    pages: 47,
    category: "Hadith & Fiqh",
  },
  {
    title: "Causes Behind The Increase & Decrease of Eemaan",
    subtitle: "Strengthening Faith",
    author: "Shaykh Abdur-Razzaq Al-Badr",
    file: "causes-of-eemaan.pdf",
    description:
      "Clarification of the key spiritual factors that elevate faith and the common sins and distractions that weaken it.",
    pages: 164,
    category: "Aqeedah & Heart",
  },
  {
    title: "Islamic Fundamentals: Zakat & Sawm",
    subtitle: "Pillars of Practice",
    author: "Islamic Studies Academy",
    file: "islamic-fundamentals-zakat-and-sawm-hints-the-principles-economic-system-in-islam.pdf",
    description:
      "An indispensable handbook for students and seekers detailing the Islamic socioeconomic principles and fasting guidelines.",
    pages: 66,
    category: "Fundamentals",
  },
  {
    title: "Bulugh Al-Maram (Kitab as-Siyam)",
    subtitle: "Attainment of the Objective",
    author: "Al-Hafidh Ibn Hajar Al-Asqalani",
    file: "bulugh-al-maram.pdf",
    description:
      "The monumental classical compilation of legal Hadiths regarding the rulings of fasting, moon-sighting, and I'tikaf.",
    pages: 576,
    category: "Hadith Masterpiece",
  },
];

export const BooksScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredBooks = BOOKS.filter(
    (book) =>
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openBook = (filename) => {
    Linking.openURL(`${WEB_BASE_URL}/books/${filename}`);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("learn.topic.books", "Books")}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t("learn.booksSubtitle", "Authentic books on fasting and spirituality")}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: colors.text, backgroundColor: colors.surface }]}
          placeholder={t("learn.searchBooks", "Search books by title, author...")}
          placeholderTextColor={colors.textSecondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredBooks.map((book, idx) => (
          <View
            key={idx}
            style={[
              styles.bookCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: "#6366F1" + "18" },
                ]}
              >
                <Ionicons name="book-outline" size={24} color="#6366F1" />
              </View>
              <View style={styles.pagesBadge}>
                <Text style={styles.pagesText}>{t("common.pages", "pages")}</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={[styles.category, { color: colors.textSecondary }]}>
                {book.category}
              </Text>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {book.title}
              </Text>
              {book.subtitle && (
                <Text style={[styles.subtitle, { color: "#6366F1" }]}>
                  {book.subtitle}
                </Text>
              )}
              <Text style={[styles.author, { color: colors.textSecondary }]}>
                {t("common.by", "By")} {book.author}
              </Text>
              <Text
                style={[styles.description, { color: colors.textSecondary }]}
                numberOfLines={3}
              >
                {book.description}
              </Text>
            </View>

            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={[styles.readButton, { backgroundColor: "#6366F1" }]}
                onPress={() => openBook(book.file)}
              >
                <Ionicons name="document-text-outline" size={16} color="white" />
                <Text style={styles.readButtonText}>{t("common.readPdf", "Read PDF")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {filteredBooks.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <Ionicons name="book-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t("common.noMatches", "No books matched your search")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {t("common.searchHint", 'Try searching for keywords like "Fasting", "Ramadhan", or "Eemaan"')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchIcon: {
    position: "absolute",
    left: 32,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 44,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  bookCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pagesBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  pagesText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  category: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  author: {
    fontSize: 13,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  readButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  readButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    borderRadius: 16,
    marginHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
});

export default BooksScreen;
