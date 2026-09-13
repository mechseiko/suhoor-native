import React, { useState, useEffect } from 'react'
import {
  Text,
  View,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
} from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Ionicons from 'react-native-vector-icons/Ionicons'

const API_BASE = 'https://ummahapi.com/api/duas'
const CACHE_KEY = 'suhoor_duas_cache'
const CACHE_TTL = 24 * 60 * 60 * 1000

let memoryCache = null

const getCache = async () => {
  if (memoryCache && (Date.now() - memoryCache.timestamp <= CACHE_TTL)) {
    return memoryCache.data
  }
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp > CACHE_TTL) {
      await AsyncStorage.removeItem(CACHE_KEY)
      memoryCache = null
      return null
    }
    memoryCache = { data, timestamp }
    return data
  } catch {
    return null
  }
}

const setCache = async (data) => {
  try {
    const existing = (await getCache()) || { categories: [], duas: {} }
    const updated = { ...existing, ...data }
    memoryCache = { data: updated, timestamp: Date.now() }
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: updated, timestamp: Date.now() }))
  } catch (err) {
    console.error('Error caching duas:', err)
  }
}

export const DuasScreen = ({ navigation }) => {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const [categories, setCategories] = useState([])
  const [duas, setDuas] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDuas, setExpandedDuas] = useState({})

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories()
  }, [])

  // Fetch duas when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchDuas()
    }
  }, [selectedCategory])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const cached = await getCache()
      if (cached?.categories && cached.categories.length > 0) {
        setCategories(cached.categories)
        setSelectedCategory(cached.categories[0].id)
        setLoading(false)
        return
      }

      const response = await fetch(`${API_BASE}/categories`)

      if (!response.ok) throw new Error('Failed to fetch categories')

      const data = await response.json()
      const categoriesData = data.data?.categories || []
      setCategories(categoriesData)
      await setCache({ categories: categoriesData })

      if (categoriesData.length > 0) {
        setSelectedCategory(categoriesData[0].id)
      }
      setError(null)
    } catch (err) {
      setError(t('duas.loadError'))
      console.error('Error fetching categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDuas = async () => {
    if (!selectedCategory) return

    try {
      setLoading(true)
      const cached = await getCache()
      if (cached?.duas?.[selectedCategory]) {
        setDuas(cached.duas[selectedCategory])
        setLoading(false)
        return
      }

      const response = await fetch(`${API_BASE}/category/${selectedCategory}`)

      if (!response.ok) throw new Error('Failed to fetch duas')

      const data = await response.json()
      const duasData = data.data?.duas || []
      setDuas(duasData)
      setExpandedDuas({})
      setError(null)

      const currentCache = (await getCache()) || { categories: [], duas: {} }
      await setCache({
        categories: currentCache.categories,
        duas: { ...currentCache.duas, [selectedCategory]: duasData }
      })
    } catch (err) {
      setError(t('duas.loadError'))
      console.error('Error fetching duas:', err)
      setDuas([])
    } finally {
      setLoading(false)
    }
  }

  const toggleDuaExpansion = (duaIndex) => {
    setExpandedDuas(prev => ({
      ...prev,
      [duaIndex]: !prev[duaIndex]
    }))
  }

  const PAGE_SIZE = 10
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Reset pagination when category or search query changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedCategory, searchQuery])

  const filteredDuas = duas.filter(dua => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      dua.title?.toLowerCase().includes(query) ||
      dua.arabic?.includes(query) ||
      dua.transliteration?.toLowerCase().includes(query) ||
      dua.translation?.toLowerCase().includes(query) ||
      dua.fawaid?.toLowerCase().includes(query)
    )
  })

  const displayedDuas = filteredDuas.slice(0, visibleCount)

  const handleLoadMore = () => {
    if (visibleCount < filteredDuas.length) {
      setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredDuas.length))
    }
  }

  const renderDuaCard = ({ item, index }) => {
    const isExpanded = expandedDuas[index]

    return (
      <View
        style={[styles.duaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <TouchableOpacity
          onPress={() => toggleDuaExpansion(index)}
          style={styles.duaHeader}
          activeOpacity={0.7}
        >
          <View style={[styles.duaAccent, { backgroundColor: colors.primary }]} />
          <View style={styles.duaTitleRow}>
            <Text style={[styles.duaTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <>
            {/* Arabic Text */}
            {item.arabic && (
              <View style={[styles.duaSection, { borderBottomColor: colors.border }]}>
                <Text style={[styles.arabicText, { color: colors.text }]} allowFontScaling={true}>
                  {item.arabic}
                </Text>
              </View>
            )}

            {/* Transliteration */}
            {item.transliteration && (
              <View style={[styles.duaSection, { backgroundColor: colors.surfaceVariant, borderBottomColor: colors.border }]}>
                <Text style={[styles.transliterationText, { color: colors.textSecondary }]}>{item.transliteration}</Text>
              </View>
            )}

            {/* Translation */}
            {item.translation && (
              <View style={[styles.duaSection, { borderBottomColor: colors.border }]}>
                <Text style={[styles.translationText, { color: colors.text }]}>"{item.translation}"</Text>
              </View>
            )}

            {/* Benefits/Fawaid */}
            {item.fawaid && (
              <View style={[styles.duaSection, { backgroundColor: colors.warning + '14', borderBottomColor: colors.border }]}>
                <Text style={[styles.fawaidLabel, { color: colors.warning }]}>{t('duas.benefits')}</Text>
                <Text style={[styles.fawaidText, { color: colors.warning }]}>{item.fawaid}</Text>
              </View>
            )}

            {/* Notes */}
            {item.notes && (
              <View style={[styles.duaSection, { borderBottomColor: colors.border }]}>
                <Text style={[styles.notesText, { color: colors.textSecondary }]}>{item.notes}</Text>
              </View>
            )}

            {/* Source */}
            {item.source && (
              <View style={[styles.duaSection, { borderTopColor: colors.border }]}>
                <Text style={[styles.sourceLabel, { color: colors.textSecondary }]}>{t('duas.source')}</Text>
                <Text style={[styles.sourceText, { color: colors.textSecondary }]}>{item.source}</Text>
              </View>
            )}
          </>
        )}
      </View>
    )
  }

  const renderCategoryButton = category => (
    <TouchableOpacity
      key={category.id}
      onPress={() => setSelectedCategory(category.id)}
      style={[
        styles.categoryBtn,
        {
          backgroundColor: selectedCategory === category.id ? colors.primary : colors.surfaceVariant,
        },
      ]}
    >
      <Text
        style={[
          styles.categoryText,
          {
            color: selectedCategory === category.id ? colors.white : colors.textSecondary,
          },
        ]}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.subtitle}>
        <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
          {t('duas.subtitle')}
        </Text>
      </View>

      {/* Categories */}
      {categories.length > 0 && (
        <View style={styles.categoriesRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {categories.map(renderCategoryButton)}
          </ScrollView>
        </View>
      )}

      {/* Search Input */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('duas.searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.error + '14' }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {/* Duas List */}
      {!loading && filteredDuas.length > 0 && (
        <FlatList
          data={displayedDuas}
          renderItem={renderDuaCard}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListFooterComponent={
            visibleCount < filteredDuas.length ? (
              <TouchableOpacity
                onPress={handleLoadMore}
                style={[styles.loadMoreBtn, { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }]}
                accessibilityRole="button"
              >
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                  {`Load more duas (${visibleCount} of ${filteredDuas.length})`}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Empty State */}
      {!loading && filteredDuas.length === 0 && !error && (
        <View style={styles.centeredState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {searchQuery ? t('duas.noResults') : t('duas.empty')}
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  subtitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  subtitleText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  categoriesRow: {
    paddingVertical: 8,
  },
  categoriesScroll: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  categoryBtn: {
    marginHorizontal: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    padding: 16,
    marginHorizontal: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadMoreBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  loadMoreText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
  },
  // Dua card
  duaCard: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  duaHeader: {
    padding: 14,
  },
  duaAccent: {
    height: 2,
    borderRadius: 1,
    marginBottom: 10,
  },
  duaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  duaTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  duaSection: {
    padding: 14,
    borderBottomWidth: 1,
  },
  arabicText: {
    fontSize: 22,
    lineHeight: 36,
    textAlign: 'right',
    fontWeight: '500',
  },
  transliterationText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  translationText: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  fawaidLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  fawaidText: {
    fontSize: 13,
    lineHeight: 18,
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  sourceText: {
    fontSize: 12,
    lineHeight: 16,
  },
})

export default DuasScreen
