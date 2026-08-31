import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** RoofClaim web primary — matches inspection-insurance-web-app BrandMark */
const RoofClaimPrimary = '#0F4C81';

type BrandLogoProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** dark = login card charcoal; primary = RoofClaim brand mark */
  variant?: 'dark' | 'primary';
};

export function BrandLogo({ size = 64, variant = 'primary', style }: BrandLogoProps) {
  const iconSize = Math.round(size * 0.42);
  const radius = Math.round(size * 0.22);
  const backgroundColor = variant === 'dark' ? '#2C2E30' : RoofClaimPrimary;

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
