import { Image, View } from 'react-native';

/** Crops the supplied artwork in the view; the original brand files stay untouched. */
export function BrandWordmark({ width = 158 }: { width?: number }) {
  return (
    <View style={{ width, height: width * 0.29, overflow: 'hidden', backgroundColor: '#000000' }}>
      <Image
        source={require('../../assets/lostfm-wordmark.png')}
        resizeMode="stretch"
        style={{ position: 'absolute', width: width * 1.558, height: width * 1.171, left: -width * 0.274, top: -width * 0.414 }}
      />
    </View>
  );
}

/** Render the transparent mark at the size needed by headers or pulse buttons. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={require('../../assets/lostfm-mark-transparent.png')}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </View>
  );
}
