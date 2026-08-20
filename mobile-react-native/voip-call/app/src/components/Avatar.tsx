import { Image, StyleSheet, View } from 'react-native';

import { BrandColors, TextColors } from '../theme/colors';

type AvatarProps = {
  name: string;
  /** Server-assigned avatar image; falls back to initials when null/absent or on error. */
  avatarUrl?: string | null;
  size?: number;
  speaking?: boolean;
};

export function Avatar({
  name,
  avatarUrl,
  size = 96,
  speaking = false,
}: AvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: speaking ? 3 : 0,
        },
      ]}>
      {Boolean(avatarUrl) && (
        <Image
          source={{ uri: avatarUrl! }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: BrandColors.darkBlue60,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: BrandColors.seaBlue80,
    overflow: 'hidden',
  },
  text: {
    color: TextColors.white,
    fontWeight: '700',
  },
});
