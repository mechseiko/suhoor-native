import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import Colors from '../constants/Colors'

export const LoadingSpinner = ({ color = Colors.primary, size = 'large' }) => {
  return (
    <View style={styles.container} className="flex-1 items-center justify-center bg-transparent">
      <ActivityIndicator size={size} color={color} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
})

export default LoadingSpinner
