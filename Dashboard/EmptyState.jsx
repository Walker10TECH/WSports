import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import theme from '../theme';

const EmptyState = ({ icon, title, message }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Feather name={icon || 'inbox'} size={32} color={theme.COLORS.primary} />
      </View>
      <Text style={styles.title}>{title || 'Nada para mostrar'}</Text>
      <Text style={styles.message}>{message || 'Não há dados disponíveis no momento.'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.SPACING.lg,
    marginVertical: theme.SPACING.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.SPACING.lg,
  },
  title: {
    fontSize: theme.FONT_SIZES.h3,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: theme.SPACING.sm,
  },
  message: {
    fontSize: theme.FONT_SIZES.lg,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default EmptyState;