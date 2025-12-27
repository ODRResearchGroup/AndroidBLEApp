import React, { useState } from 'react';
import { View, Button, Text } from 'react-native';
import { Buffer } from 'buffer';
import { supabase } from '../services/Supabase';

function generateFakePngBytes() {
  // 1x1 transparent PNG (base64)
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export default function SupabaseUploadTestScreen() {
  const [status, setStatus] = useState('Idle');
  const [lastPath, setLastPath] = useState<string | null>(null);

  const uploadFakeImage = async () => {
    try {
      setStatus('Generating image...');
      const bytes = generateFakePngBytes();

      const bucket = 'test-images';
      const filePath = `fake/test-${Date.now()}.png`;

      setStatus('Uploading to Supabase...');
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, bytes, {
          contentType: 'image/png',
          upsert: false,
        })

      if (error) {throw error;}

      setLastPath(filePath);
      setStatus('Uploaded ✅');
    } catch (e: any) {
      console.error(e)
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Button title="Upload fake image" onPress={uploadFakeImage} />
      <Text>{status}</Text>
      {lastPath ? <Text>Last upload: {lastPath}</Text> : null}
    </View>
  );
}
