import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand } from '@/constants/theme';

type BrandLogoProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** dark = login card charcoal; primary = RoofCheck brand mark */
  variant?: 'dark' | 'primary';
};

export function BrandLogo({ size = 64, variant = 'primary', style }: BrandLogoProps) {
  const iconSize = Math.round(size * 0.42);
  const radius = Math.round(size * 0.22);
  const backgroundColor = variant === 'dark' ? '#2C2E30' : Brand.primary;

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor,
          borderRadius: radius,
          height: size,
          width: size,
        },
        style,
      ]}
    >
      <Ionicons color="#FFFFFF" name="shield-outline" size={iconSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
