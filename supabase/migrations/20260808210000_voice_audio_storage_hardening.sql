-- Ensure generated Voice/TTS audio is private and only served through signed URLs.
update storage.buckets
set public = false
where id = 'voice-audio';

drop policy if exists "Public read access for voice audio" on storage.objects;
drop policy if exists "Service role can upload voice audio" on storage.objects;
drop policy if exists "Service role can delete old audio files" on storage.objects;
drop policy if exists "Service role can delete voice audio" on storage.objects;
