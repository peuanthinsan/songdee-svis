import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing, borderRadius } from '../constants/theme';

export function HeaderLogo() {
  return (
    <View style={styles.wrap}>
      <View style={styles.chip}>
        <Image
          source={require('../assets/songdee-vis-logo.svg')}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingRight: spacing.md,
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: colors.white,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  logo: {
    width: 100,
    height: 32,
  },
});
