import { Platform, PermissionsAndroid } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import ReactNativeBlobUtil from 'react-native-blob-util';

export type StartRecordingResult = {
  localUri: string;
  plannedPath: string;
};

export type StopRecordingResult = {
  localUri: string | null;
};

async function ensureMicPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
  );

  if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }

  return false;
}

function pickFileExtension() {
  return 'm4a';
}

function buildLocalRecordingPath(ext: string, recordingId: string) {
  const baseDir =
    Platform.OS === 'android'
      ? ReactNativeBlobUtil.fs.dirs.CacheDir
      : ReactNativeBlobUtil.fs.dirs.DocumentDir;

  return `${baseDir}/recording-${recordingId}.${ext}`;
}

export async function startAudioRecording(recordingId: string): Promise<StartRecordingResult> {
  const ok = await ensureMicPermission();
  if (!ok) {
    throw new Error('Microphone permission denied');
  }

  const ext = pickFileExtension();
  const plannedPath = buildLocalRecordingPath(ext, recordingId);

  const localUri = await AudioRecorderPlayer.startRecorder(plannedPath);

  return { localUri, plannedPath };
}

export async function stopAudioRecording(): Promise<StopRecordingResult> {
  const localUri = await AudioRecorderPlayer.stopRecorder();
  AudioRecorderPlayer.removeRecordBackListener();

  if (localUri) {
    return { localUri };
  }

  return { localUri: null };
}
