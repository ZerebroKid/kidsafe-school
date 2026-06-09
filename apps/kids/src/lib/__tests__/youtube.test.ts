import {
  contentIncludesYouTubeVideo,
  extractYouTubeId,
  isYouTubeUrl,
} from '../youtube';

describe('youtube helpers', () => {
  it('extracts ids from youtu.be and watch urls', () => {
    expect(extractYouTubeId('https://youtu.be/NS4vHqJIPiE?si=abc')).toBe(
      'NS4vHqJIPiE',
    );
    expect(
      extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('detects youtube lines', () => {
    expect(isYouTubeUrl('https://youtu.be/NS4vHqJIPiE?si=abc')).toBe(true);
    expect(isYouTubeUrl('Some plain text')).toBe(false);
  });

  it('detects when content already includes a section video', () => {
    const content =
      'Video Search Query\nhttps://youtu.be/NS4vHqJIPiE?si=abc';
    expect(
      contentIncludesYouTubeVideo(content, 'https://youtu.be/NS4vHqJIPiE'),
    ).toBe(true);
  });
});
