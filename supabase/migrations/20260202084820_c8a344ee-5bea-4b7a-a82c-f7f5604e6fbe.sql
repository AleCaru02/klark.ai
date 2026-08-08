-- Create storage bucket for voice audio files (ElevenLabs TTS)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice-audio', 'voice-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow public read access (Twilio needs to fetch audio)
CREATE POLICY "Public read access for voice audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'voice-audio');

-- Create policy for service role to upload audio
CREATE POLICY "Service role can upload voice audio"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'voice-audio');

-- Create policy for service role to delete old audio files
CREATE POLICY "Service role can delete voice audio"
ON storage.objects
FOR DELETE
USING (bucket_id = 'voice-audio');