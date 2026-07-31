import { View, StyleSheet, Image } from 'react-native';
import { colors, borderRadius } from '../constants/theme';

export function HeaderLogo() {
  return (
    <View style={styles.wrap}>
      <View style={styles.chip}>
        <Image
          source={require('../assets/songdee-vis-logo.jpg')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingRight: 12,
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: colors.white,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    width: 76,
    height: 30,
  },
});
