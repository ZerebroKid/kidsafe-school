/** Shared YouTube URL helpers for topic content and VideoPlayer. */

export function extractYouTubeId(url: string): string | null {
  if (!url) {
    return null;
  }
  const trimmed = url.trim();
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) {
    return watchMatch[1];
  }
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return shortMatch[1];
  }
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) {
    return embedMatch[1];
  }
  return null;
}

export function isYouTubeUrl(text: string): boolean {
  return extractYouTubeId(text) !== null;
}

export function contentIncludesYouTubeVideo(
  content: string,
  videoUrl: string,
): boolean {
  const id = extractYouTubeId(videoUrl);
  return id !== null && content.includes(id);
}
