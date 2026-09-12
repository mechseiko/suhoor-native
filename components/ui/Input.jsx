import React, { useState } from 'react'
import { TextInput, TouchableOpacity, View } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import Text from './Text'
import { alpha } from '../../theme'

/**
 * Labelled text field matching the web form control:
 *
 *   w-full px-4 py-3 border border-gray-300 rounded-lg
 *   focus:ring-2 focus:ring-primary focus:border-transparent
 *
 * So: a real border (not a filled grey box), `rounded-lg`, and a brand-coloured
 * focus ring. The label above it is the web's
 * `text-sm font-medium text-gray-700`.
 *
 * `secure` adds the eye toggle the web login/signup pages have.
 */
export const Input = ({
  label,
  icon,
  secure = false,
  error,
  hint,
  containerStyle,
  style,
  className,
  editable = true,
  ...rest
}) => {
  const { colors } = useTheme()
  const { isRTL } = useLanguage()
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const borderColor = error
    ? colors.error
    : colors.borderStrong

  return (
    <View className={`mb-4 ${className ?? ''}`} style={containerStyle}>
      {label && (
        <Text variant="label" className="mb-2">
          {label}
        </Text>
      )}

      <View
        className="h-12 flex-row items-center rounded-md border px-2"
        style={{
          borderColor,
          backgroundColor: editable ? colors.surface : colors.surfaceVariant,
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.primary : colors.muted}
            style={{ marginEnd: 12 }}
          />
        )}

        <TextInput
          className="h-full flex-1"
          style={{
            color: editable ? colors.textBody : colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
            backgroundColor: 'transparent',
            paddingVertical: 0,
            ...style,
          }}
          placeholderTextColor={colors.muted}
          secureTextEntry={secure && !revealed}
          editable={editable}
          underlineColorAndroid="transparent"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />

        {secure && (
          <TouchableOpacity
            onPress={() => setRevealed(value => !value)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={revealed ? colors.primary : colors.muted}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text variant="caption" tone="error" className="mt-1">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="secondary" className="mt-1">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

export default Input
