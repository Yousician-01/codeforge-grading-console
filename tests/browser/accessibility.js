import AxeBuilder from '@axe-core/playwright';

export async function analyzeAccessibility(page) {
  // axe samples rendered colors: scan the settled UI, not translucent fade frames.
  // Keep motion enabled so browser tests still exercise normal user interactions.
  await page.evaluate(async () => {
    await document.fonts.ready;
    let animations;
    do {
      animations = document.getAnimations().filter(animation =>
        animation.playState !== 'finished' &&
        animation.playState !== 'paused' &&
        animation.effect?.getComputedTiming().iterations !== Infinity
      );
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    } while (animations.length);
  });
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
}
