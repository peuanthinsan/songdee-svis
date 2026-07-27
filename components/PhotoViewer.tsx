import { Modal, View, TouchableOpacity, StyleSheet, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../constants/theme';

const { width, height } = Dimensions.get('window');

type Props = {
  photos: string[];
  visible: boolean;
  initialIndex?: number;
  onClose: () => void;
};

export function PhotoViewer({ photos, visible, initialIndex = 0, onClose }: Props) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.white} />
        </TouchableOpacity>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={styles.page}>
              <Image
                source={{ uri: item }}
                style={styles.image}
                contentFit="contain"
              />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  page: {
    width,
    height: height * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width - 32,
    height: height * 0.65,
  },
});
