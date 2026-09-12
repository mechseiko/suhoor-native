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
      <View className="rounded-xl border mb-3 overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <TouchableOpacity
          onPress={() => toggleDuaExpansion(index)}
          className="p-3"
        >
          <View className="h-1" style={{ backgroundColor: colors.primary }}></View>
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-sm font-medium mr-2" style={{ color: colors.text }} numberOfLines={2}>
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
              <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
                <Text className="text-[22px] leading-8 text-right font-medium" style={{ color: colors.text }} allowFontScaling={true}>
                  {item.arabic}
                </Text>
              </View>
            )}

            {/* Transliteration */}
            {item.transliteration && (
              <View className="p-3 border-b" style={{ backgroundColor: colors.surfaceVariant, borderBottomColor: colors.border }}>
                <Text className="text-sm italic leading-[18px]" style={{ color: colors.textSecondary }}>{item.transliteration}</Text>
              </View>
            )}

            {/* Translation */}
            {item.translation && (
              <View className="p-3 border-b" style={{ borderBottomColor: colors.border }}>
                <Text className="text-sm leading-5 italic" style={{ color: colors.text }}>"{item.translation}"</Text>
              </View>
            )}

            {/* Benefits/Fawaid */}
            {item.fawaid && (
              <View className="p-3 border-b" style={{ backgroundColor: colors.warning + '14', borderBottomColor: colors.border }}>
                <Text className="text-xs font-bold mb-1" style={{ color: colors.warning }}>{t('duas.benefits')}</Text>
                <Text className="text-sm leading-[18px]" style={{ color: colors.warning }}>{item.fawaid}</Text>
              </View>
            )}

            {/* Notes */}
            {item.notes && (
              <View className="p-2.5 border-b" style={{ borderBottomColor: colors.border }}>
                <Text className="text-xs italic text-center" style={{ color: colors.textSecondary }}>{item.notes}</Text>
              </View>
            )}

            {/* Source */}
            {item.source && (
              <View className="p-3 border-t" style={{ borderTopColor: colors.border }}>
                <Text className="text-xs font-bold mb-1" style={{ color: colors.textSecondary }}>{t('duas.source')}</Text>
                <Text className="text-xs leading-4" style={{ color: colors.textSecondary }}>{item.source}</Text>
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
      className="mx-1.5 px-4 py-2 rounded-full justify-center"
      style={{
        backgroundColor: selectedCategory === category.id ? colors.primary : colors.surfaceVariant,
      }}
    >
      <Text
        className="text-sm font-semibold"
        style={{
          color: selectedCategory === category.id ? colors.white : colors.textSecondary,
        }}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-3 pb-1">
        <Text className="text-[13.5px] leading-[18px]" style={{ color: colors.textSecondary }}>
          {t('duas.subtitle')}
        </Text>
      </View>

      {/* Categories */}
      {categories.length > 0 && (
        <View className="py-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center' }}
          >
            {categories.map(renderCategoryButton)}
          </ScrollView>
        </View>
      )}

      {/* Search Input */}
      <View className="flex-row items-center mx-3 my-2 px-3 py-2 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: '#E5E7EB' }}>
        <Ionicons name="search" size={20} color={colors.textSecondary} className="mr-2" />
        <TextInput
          className="flex-1 text-sm"
          style={{ color: colors.text }}
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
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Error */}
      {error && (
        <View className="p-4 mx-3 rounded-lg" style={{ backgroundColor: colors.error + '14' }}>
          <Text className="text-sm" style={{ color: colors.error }}>{error}</Text>
        </View>
      )}

      {/* Duas List */}
      {!loading && filteredDuas.length > 0 && (
        <FlatList
          data={displayedDuas}
          renderItem={renderDuaCard}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListFooterComponent={
            visibleCount < filteredDuas.length ? (
              <TouchableOpacity
                onPress={handleLoadMore}
                className="py-3.5 items-center justify-center my-2.5 rounded-lg border"
                style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                accessibilityRole="button"
              >
                <Text className="text-[13.5px] font-semibold" style={{ color: colors.primary }}>
                  {`Load more duas (${visibleCount} of ${filteredDuas.length})`}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Empty State */}
      {!loading && filteredDuas.length === 0 && !error && (
        <View className="flex-1 justify-center items-center">
          <Text className="text-base" style={{ color: colors.textSecondary }}>
            {searchQuery ? t('duas.noResults') : t('duas.empty')}
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}

export default DuasScreen
