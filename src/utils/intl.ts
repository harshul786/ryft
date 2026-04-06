/** Stub for claude-cli utils/intl — provides Intl.Segmenter for grapheme splitting */
let _segmenter: Intl.Segmenter | null = null;

export function getGraphemeSegmenter(): Intl.Segmenter {
  if (!_segmenter) {
    _segmenter = new Intl.Segmenter();
  }
  return _segmenter;
}
