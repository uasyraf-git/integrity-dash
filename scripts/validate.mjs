#!/usr/bin/env node
// Deterministic validation for Integrity Dash's core calculation logic (Sprint 3C, Task 9).
//
// No test framework: the project doesn't have one, and this sprint's guidance is explicit not
// to add one solely for this. Instead this is a small, dependency-free assertion harness over
// the pure, rendering-independent modules (AdaptiveDifficultyDirector, RunAnalytics,
// EndRunRating) - run via `npm run validate`, which first compiles just those files
// (tsconfig.validate.json) to CommonJS in .validate-build/, then runs this script against the
// compiled output.
//
// Usage: npm run validate

import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(here, '..', '.validate-build');

if (!existsSync(buildDir)) {
  console.error('.validate-build not found - run `npm run validate` (it compiles first).');
  process.exit(1);
}

// Node treats extensionless .js as ESM by default (package.json has "type": "module") - this
// local override tells Node's resolver the compiled output is CommonJS, matching
// tsconfig.validate.json's `module: "CommonJS"`, without touching any source import statements.
writeFileSync(path.join(buildDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));

const { AdaptiveDifficultyDirector, computeRating, computePerformanceScore, clampModifiers } = await import(
  path.join(buildDir, 'systems', 'AdaptiveDifficultyDirector.js')
);
const { RunAnalytics } = await import(path.join(buildDir, 'systems', 'RunAnalytics.js'));
const { calculateEndRunRating } = await import(path.join(buildDir, 'systems', 'EndRunRating.js'));
const { DirectorMode, PerformanceRating, EVALUATION_INTERVAL, MODE_CHANGE_COOLDOWN, ASSISTANCE_DURATION, MINIMUM_MODIFIER, MAXIMUM_MODIFIER, ASSISTANCE_MODIFIERS } =
  await import(path.join(buildDir, 'config', 'adaptiveDifficultyConfig.js'));

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`);
  }
}

function approxEqual(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) < epsilon;
}

function baseSnapshot(overrides = {}) {
  return {
    integrityPercent: 100,
    currentMultiplier: 1,
    bestMultiplier: 1,
    currentStreak: 0,
    bestStreak: 0,
    tokensCollected: 0,
    nearMissCountSinceLastEvaluation: 0,
    obstacleHitsSinceLastEvaluation: 0,
    timeSinceLastHit: 999,
    survivalDuration: 0,
    ...overrides,
  };
}

// --- 1. Performance rating calculation + hysteresis --------------------------------------
console.log('\n1. Performance rating calculation');
{
  const struggling = computePerformanceScore(baseSnapshot({ integrityPercent: 20, obstacleHitsSinceLastEvaluation: 2 }));
  const excellent = computePerformanceScore(
    baseSnapshot({ integrityPercent: 100, currentStreak: 20, bestMultiplier: 4, nearMissCountSinceLastEvaluation: 3 }),
  );
  check('a struggling snapshot scores lower than an excellent one', struggling < excellent);

  // Hysteresis: a rating can only move one step per call, and only once it clears the boundary
  // by the configured margin - not merely touches it.
  check(
    'rating stays put when score barely crosses the boundary (hysteresis)',
    computeRating(0.31, PerformanceRating.STRUGGLING) === PerformanceRating.STRUGGLING,
  );
  check(
    'rating moves up once the score clears the boundary by the margin',
    computeRating(0.5, PerformanceRating.STRUGGLING) === PerformanceRating.STABLE,
  );
  check(
    'rating never skips a step in one call (STRUGGLING + huge score -> STABLE, not EXCELLENT)',
    computeRating(5, PerformanceRating.STRUGGLING) === PerformanceRating.STABLE,
  );
  check(
    'rating moves down once the score clears the lower boundary by the margin',
    computeRating(-1, PerformanceRating.STABLE) === PerformanceRating.STRUGGLING,
  );
}

// --- 2. Director state transitions, cooldown, and mode duration --------------------------
// Each mechanism is isolated with deliberately-sized time steps (ASSISTANCE_DURATION (12s) <
// EVALUATION_INTERVAL (18s) < MODE_CHANGE_COOLDOWN (20s) with current config), rather than
// chaining same-size steps that would let one mechanism's timing accidentally mask another's.
console.log('\n2. Director state transitions');
{
  const director = new AdaptiveDifficultyDirector(true);
  const strugglingSnapshot = baseSnapshot({ integrityPercent: 15, obstacleHitsSinceLastEvaluation: 3 });
  const excellentSnapshot = baseSnapshot({ integrityPercent: 100, currentStreak: 20, bestMultiplier: 4 });

  // Not enough time has passed yet - must not evaluate early.
  const earlyResult = director.update(1, strugglingSnapshot);
  check('does not evaluate before EVALUATION_INTERVAL has elapsed', earlyResult.evaluated === false);

  // Cross the evaluation interval - a struggling snapshot should enter Assistance Mode.
  const evalResult = director.update(EVALUATION_INTERVAL - 1, strugglingSnapshot);
  check('evaluates once EVALUATION_INTERVAL has elapsed', evalResult.evaluated === true);
  check('enters Assistance Mode for a struggling snapshot', director.getMode() === DirectorMode.ASSISTANCE);
  check('reports a mode change on the entering call', evalResult.modeChanged === true && evalResult.newMode === DirectorMode.ASSISTANCE);
  check(
    'reports Assistance modifiers (clamped) while active',
    approxEqual(director.getModifiers().obstacleSpawnIntervalModifier, ASSISTANCE_MODIFIERS.obstacleSpawnIntervalModifier),
  );

  // A small step, well under both the mode duration and the evaluation interval, with a
  // snapshot that would otherwise flip the rating - must not re-evaluate every frame, and the
  // active mode must not be interrupted mid-flight.
  const smallStepResult = director.update(1, excellentSnapshot);
  check('does not evaluate on every call (small step)', smallStepResult.evaluated === false);
  check('an active mode is not interrupted before its own duration elapses', director.getMode() === DirectorMode.ASSISTANCE);

  // Cross ASSISTANCE_DURATION (from mode entry) without yet crossing EVALUATION_INTERVAL again -
  // the mode should auto-expire on its own, independent of any evaluation happening.
  const revertResult = director.update(ASSISTANCE_DURATION - 1, strugglingSnapshot);
  check('mode reverts to NONE once its own duration elapses (no evaluation needed)', director.getMode() === DirectorMode.NONE);
  check('the auto-revert itself is not counted as an evaluation', revertResult.evaluated === false);

  // Cross the next evaluation interval while still within MODE_CHANGE_COOLDOWN of the original
  // entry - cooldown must block a new mode even though the Director is back at neutral.
  const stillCoolingDownResult = director.update(EVALUATION_INTERVAL - (ASSISTANCE_DURATION - 1), strugglingSnapshot);
  check('an evaluation does happen here', stillCoolingDownResult.evaluated === true);
  check('cooldown (measured from mode entry) blocks a new mode right after reverting', director.getMode() === DirectorMode.NONE);

  // Advance well past MODE_CHANGE_COOLDOWN from the original entry, and past the next
  // evaluation interval - a new mode should now be reachable again.
  director.update(MODE_CHANGE_COOLDOWN, strugglingSnapshot);
  check('a new mode can start again once the cooldown has fully elapsed', director.getMode() === DirectorMode.ASSISTANCE);
}

// --- 3. Director disabled configuration ---------------------------------------------------
console.log('\n3. Director disabled configuration');
{
  const disabled = new AdaptiveDifficultyDirector(false);
  const strugglingSnapshot = baseSnapshot({ integrityPercent: 5, obstacleHitsSinceLastEvaluation: 3 });
  for (let i = 0; i < 5; i++) disabled.update(EVALUATION_INTERVAL, strugglingSnapshot);
  check('disabled Director never evaluates', disabled.getMode() === DirectorMode.NONE);
  const modifiers = disabled.getModifiers();
  check(
    'disabled Director always reports neutral modifiers',
    modifiers.obstacleSpawnIntervalModifier === 1 &&
      modifiers.complexPatternWeightModifier === 1 &&
      modifiers.multiLanePatternWeightModifier === 1 &&
      modifiers.collectibleSpawnModifier === 1 &&
      modifiers.difficultObstacleWeightModifier === 1,
  );
}

// --- 4. Modifier limits ---------------------------------------------------------------------
console.log('\n4. Modifier limits');
{
  const outOfRange = clampModifiers({
    obstacleSpawnIntervalModifier: 5,
    complexPatternWeightModifier: -3,
    multiLanePatternWeightModifier: MAXIMUM_MODIFIER,
    collectibleSpawnModifier: MINIMUM_MODIFIER,
    difficultObstacleWeightModifier: 1,
  });
  check('clamps an over-maximum value down to MAXIMUM_MODIFIER', outOfRange.obstacleSpawnIntervalModifier === MAXIMUM_MODIFIER);
  check('clamps an under-minimum value up to MINIMUM_MODIFIER', outOfRange.complexPatternWeightModifier === MINIMUM_MODIFIER);
  check('leaves an already-in-range value unchanged', outOfRange.difficultObstacleWeightModifier === 1);
  check(
    'the authored ASSISTANCE_MODIFIERS are already within bounds',
    Object.values(ASSISTANCE_MODIFIERS).every((v) => v >= MINIMUM_MODIFIER && v <= MAXIMUM_MODIFIER),
  );
}

// --- 5. RunAnalytics reset and freeze ------------------------------------------------------
console.log('\n5. RunAnalytics reset and freeze');
{
  const analytics = new RunAnalytics();
  analytics.update(1, 2);
  analytics.recordJump();
  analytics.recordSlide();
  analytics.recordLaneChange();
  analytics.recordObstacleHit();
  analytics.recordNearMiss();
  analytics.recordTokensMissed(2);
  analytics.recordDirectorAssistance();
  analytics.recordDirectorChallenge();

  const context = { score: 100, distance: 50, tokensCollected: 3, bestStreak: 5, bestMultiplier: 2, integrityRemaining: 80 };
  const before = analytics.getSummary(context);
  check('records all tracked metrics before reset', before.jumpCount === 1 && before.slideCount === 1 && before.laneChangeCount === 1);
  check('records obstacle hits, near misses, and missed tokens', before.obstacleHits === 1 && before.nearMissCount === 1 && before.tokensMissed === 2);
  check('records Director activations', before.directorAssistanceActivations === 1 && before.directorChallengeActivations === 1);

  analytics.freeze();
  analytics.update(10, 4);
  analytics.recordJump();
  const afterFreeze = analytics.getSummary(context);
  check('freeze() stops further recording (duration unchanged)', approxEqual(afterFreeze.runDurationSeconds, before.runDurationSeconds));
  check('freeze() stops further recording (jump count unchanged)', afterFreeze.jumpCount === before.jumpCount);

  analytics.reset();
  const afterReset = analytics.getSummary(context);
  check(
    'reset() zeroes every tracked counter',
    afterReset.runDurationSeconds === 0 &&
      afterReset.jumpCount === 0 &&
      afterReset.slideCount === 0 &&
      afterReset.laneChangeCount === 0 &&
      afterReset.obstacleHits === 0 &&
      afterReset.nearMissCount === 0 &&
      afterReset.tokensMissed === 0 &&
      afterReset.directorAssistanceActivations === 0 &&
      afterReset.directorChallengeActivations === 0,
  );

  analytics.update(1, 3);
  const afterResetRecording = analytics.getSummary(context);
  check('reset() re-enables recording (not still frozen)', afterResetRecording.runDurationSeconds > 0);
}

// --- 6. Average multiplier calculation ------------------------------------------------------
console.log('\n6. Average multiplier calculation (time-weighted)');
{
  const analytics = new RunAnalytics();
  analytics.update(1, 2); // 1s at x2
  analytics.update(1, 2); // 1s at x2
  analytics.update(1, 2); // 1s at x2
  analytics.update(1, 4); // 1s at x4
  const summary = analytics.getSummary({ score: 0, distance: 0, tokensCollected: 0, bestStreak: 0, bestMultiplier: 4, integrityRemaining: 100 });
  // (2+2+2+4)/4 = 2.5
  check('time-weighted average multiplier is correct', approxEqual(summary.averageMultiplier, 2.5));

  const fresh = new RunAnalytics();
  const freshSummary = fresh.getSummary({ score: 0, distance: 0, tokensCollected: 0, bestStreak: 0, bestMultiplier: 1, integrityRemaining: 100 });
  check('average multiplier defaults to 1 with zero run duration (no division by zero)', freshSummary.averageMultiplier === 1);
}

// --- 7. End Run Rating determinism and boundaries -------------------------------------------
console.log('\n7. End Run Rating');
{
  const summary = {
    runDurationSeconds: 90,
    distance: 900,
    score: 1500,
    tokensCollected: 15,
    tokensMissed: 2,
    collectionRate: 15 / 17,
    nearMissCount: 4,
    obstacleHits: 1,
    bestStreak: 12,
    bestMultiplier: 3,
    averageMultiplier: 2.2,
    jumpCount: 20,
    slideCount: 10,
    laneChangeCount: 15,
    integrityRemaining: 80,
    directorAssistanceActivations: 0,
    directorChallengeActivations: 1,
  };
  const ratingA = calculateEndRunRating(summary);
  const ratingB = calculateEndRunRating({ ...summary });
  check(
    'the same run summary always produces the same rating (deterministic)',
    ratingA.stars === ratingB.stars && ratingA.title === ratingB.title && approxEqual(ratingA.compositeScore, ratingB.compositeScore),
  );
  check('rating never rates only by score (a mid-score, high-integrity run is not automatically 1 star)', ratingA.stars >= 3);

  const perfect = {
    runDurationSeconds: 300,
    distance: 3000,
    score: 10000,
    tokensCollected: 50,
    tokensMissed: 0,
    collectionRate: 1,
    nearMissCount: 20,
    obstacleHits: 0,
    bestStreak: 40,
    bestMultiplier: 4,
    averageMultiplier: 4,
    jumpCount: 40,
    slideCount: 20,
    laneChangeCount: 30,
    integrityRemaining: 100,
    directorAssistanceActivations: 0,
    directorChallengeActivations: 3,
  };
  const perfectRating = calculateEndRunRating(perfect);
  check('a near-perfect run reaches the 5-star boundary', perfectRating.stars === 5);

  const poor = {
    runDurationSeconds: 8,
    distance: 60,
    score: 20,
    tokensCollected: 0,
    tokensMissed: 3,
    collectionRate: 0,
    nearMissCount: 0,
    obstacleHits: 4,
    bestStreak: 0,
    bestMultiplier: 1,
    averageMultiplier: 1,
    jumpCount: 1,
    slideCount: 0,
    laneChangeCount: 0,
    integrityRemaining: 0,
    directorAssistanceActivations: 1,
    directorChallengeActivations: 0,
  };
  const poorRating = calculateEndRunRating(poor);
  check('a very short, damaging run reaches the 1-star boundary', poorRating.stars === 1);
  check('even a 1-star rating still has an encouraging, non-humiliating feedback line', poorRating.feedback.length > 0);
  check('the Director internal rating/mode is never part of the rating output', !('mode' in poorRating) && !('rating' in poorRating));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
