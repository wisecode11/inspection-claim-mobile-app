import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, ui } from '@/components/inspection-ui';
import { useInspection } from '@/context/inspection-context';

export default function PhotosScreen() {
  const router = useRouter();
  const { data, update } = useInspection();
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera access needed', 'Allow camera access to add inspection photos.');
    const result = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.back, quality: 0.8, exif: true });
    if (!result.canceled) update({ photos: [...data.photos, result.assets[0].uri] });
  };
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) update({ photos: [...data.photos, result.assets[0].uri] });
  };
  const remove = (uri: string) => update({ photos: data.photos.filter((photo) => photo !== uri) });

  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.title}>Roof photos</Text><Text style={ui.subtitle}>{data.photos.length} photo{data.photos.length === 1 ? '' : 's'} captured • GPS and timestamp stored locally</Text>
    <View style={styles.actions}><Pressable style={styles.capture} onPress={takePhoto}><Text style={styles.captureText}>⌾  Take Photo</Text></Pressable><Pressable style={styles.gallery} onPress={choosePhoto}><Text style={styles.galleryText}>Gallery</Text></Pressable></View>
    {data.photos.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>No roof photos yet</Text></View> : <View style={styles.grid}>{data.photos.map((uri) => <View key={uri} style={styles.photoWrap}><Image source={{ uri }} style={styles.photo} /><Pressable onPress={() => remove(uri)} style={styles.delete}><Text style={styles.deleteText}>Delete</Text></Pressable></View>)}</View>}
    <View style={{ marginTop: 28 }}><PrimaryButton title="Next: Hail Test" onPress={() => router.push('/hail-test')} /></View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  capture: { alignItems: 'center', backgroundColor: '#163A4A', borderRadius: 12, flex: 1, padding: 14 },
  captureText: { color: '#FFF', fontWeight: '800' },
  gallery: { alignItems: 'center', borderColor: '#163A4A', borderRadius: 12, borderWidth: 1, flex: 1, padding: 14 },
  galleryText: { color: '#163A4A', fontWeight: '800' },
  empty: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, marginTop: 16, padding: 28 },
  emptyText: { color: '#70818A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  photoWrap: { width: '47%' },
  photo: { borderRadius: 12, height: 140, width: '100%' },
  delete: { alignItems: 'center', marginTop: 6 },
  deleteText: { color: '#BD3C2D', fontSize: 13, fontWeight: '800' },
});
