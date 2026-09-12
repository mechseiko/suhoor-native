import React, { createContext, useContext, useState, useEffect } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { themes } from '../theme'

const ThemeContext = createContext({})

export const useTheme = () => useContext(ThemeContext)

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme()
  // The product's default canvas is the website's light surface. A saved user
  // preference still takes precedence, and system mode remains available from
  // settings when explicitly selected.
  const [themeMode, setThemeModeState] = useState('light') // 'light', 'dark', 'system'

  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('suhoor_theme_mode')
        if (savedMode) {
          setThemeModeState(savedMode)
        }
      } catch (error) {
        console.error('Failed to load theme mode:', error)
      }
    }
    loadThemeMode()
  }, [])

  const setThemeMode = async mode => {
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      try {
        setThemeModeState(mode)
        await AsyncStorage.setItem('suhoor_theme_mode', mode)
      } catch (error) {
        console.error('Failed to save theme mode:', error)
      }
    }
  }

  const activeMode =
    themeMode === 'system' ? systemColorScheme || 'light' : themeMode
  const colors = themes[activeMode]
  const isDark = activeMode === 'dark'

  const value = {
    themeMode,
    setThemeMode,
    colors,
    isDark,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export default ThemeContext
