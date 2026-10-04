import test from 'node:test';
import assert from 'node:assert/strict';
import { AtmosphereTransition, LightingTransition, lightingFogBrightness, qualityProfile, CAMERA_PROFILES, architecturalLightLevel } from '../ai_builder/static/atmosphere-profile.mjs';

test('weather changes blend rather than jumping on confirmation', () => {
  const blend = new AtmosphereTransition();
  blend.set('rain');
  const first = blend.advance(1 / 60);
  assert.ok(first.wet > 0 && first.wet < .1);
  for (let i = 0; i < 360; i++) blend.advance(1 / 60);
  assert.ok(blend.advance(0).wet > .999);
});
test('interrupted weather transitions remain normalised and nonnegative', () => {
  const blend = new AtmosphereTransition();
  for (const name of ['rain', 'snow', 'fog', 'clear', 'snow']) {
    blend.set(name);
    for (let i = 0; i < 13; i++) blend.advance(.016);
    assert.ok(Object.values(blend.weights).every(v => v >= 0 && v <= 1));
    assert.ok(Math.abs(Object.values(blend.weights).reduce((a, b) => a + b) - 1) < 1e-10);
  }
});
test('pause and background time cannot produce an instant weather jump', () => {
  const blend = new AtmosphereTransition();
  blend.set('snow');
  assert.equal(blend.advance(0).snow, 0);
  assert.ok(blend.advance(30).snow < .2);
});
test('quality tiers reduce only presentation workload', () => {
  assert.equal(qualityProfile('low').reflections, false);
  assert.equal(qualityProfile('balanced').glassTransmission, 0);
  assert.equal(qualityProfile('high').glassTransmission, .08);
  assert.ok(qualityProfile('low').particles < qualityProfile('high').particles);
  assert.equal(qualityProfile('missing'), qualityProfile('balanced'));
  assert.ok(Object.isFrozen(qualityProfile('high')));
});
test('unknown weather resolves to clear and never creates extra states', () => {
  const blend = new AtmosphereTransition('unsupported');
  blend.set('unsupported');
  assert.equal(blend.target, 'clear');
  assert.equal(blend.advance(.016).wet, 0);
});

test('window lights remain subdued in daylight and brighten at dusk', () => {
  assert.ok(architecturalLightLevel(.12,'daylight') < .06);
  assert.ok(architecturalLightLevel(1,'daylight') < architecturalLightLevel(.12,'blue'));
  assert.ok(architecturalLightLevel(1,'golden') < .5);
});
test('window lighting clamps bad input without emitting nonfinite intensity', () => {
  for(const value of [NaN,Infinity,-4,8])
    assert.ok(Number.isFinite(architecturalLightLevel(value)));
  assert.equal(architecturalLightLevel(-4),architecturalLightLevel(0));
  assert.equal(architecturalLightLevel(8),architecturalLightLevel(1));
});
test('named cameras have immutable finite metre-scale poses', () => {
  assert.deepEqual(Object.keys(CAMERA_PROFILES),['bird','street','corner']);
  for(const profile of Object.values(CAMERA_PROFILES)) {
    assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.target));
    assert.ok(profile.radius >= 25 && profile.radius < 100);
    assert.ok(profile.phi > 0 && profile.phi < Math.PI/2);
    assert.ok(profile.target.every(Number.isFinite));
  }
  assert.ok(CAMERA_PROFILES.street.radius > 40);
});

test('lighting changes start at the current appearance and converge without a jump', () => {
  const light=new LightingTransition(); light.set('blue');
  assert.equal(light.advance(0).blue,0);
  assert.ok(light.advance(1/60).blue>0 && light.weights.blue<.05);
  assert.equal(light.settled,false);
  for(let i=0;i<480;i++)light.advance(1/60);
  assert.ok(light.weights.blue>.999); assert.equal(light.settled,true);
});
test('interrupted lighting changes stay normalised and preserve the current appearance', () => {
  const light=new LightingTransition();light.set('golden');light.advance(.1);
  const before={...light.weights};light.set('blue');
  assert.deepEqual(light.advance(0),before);
  for(const style of ['blue','golden','daylight']){
    light.set(style);for(let i=0;i<7;i++)light.advance(.016);
    assert.ok(Object.values(light.weights).every(x=>x>=0&&x<=1));
    assert.ok(Math.abs(Object.values(light.weights).reduce((a,b)=>a+b)-1)<1e-10);
  }
});
test('invalid time cannot corrupt lighting and background intervals are bounded', () => {
  const light=new LightingTransition();light.set('blue');
  for(const seconds of [NaN,Infinity,-1])assert.equal(light.advance(seconds).blue,0);
  assert.ok(light.advance(30).blue<.2);
  light.set('missing');assert.equal(light.target,'blue');
});
test('fog follows continuous dusk lighting instead of keeping daylight brightness', () => {
  assert.equal(lightingFogBrightness(0),1);
  assert.equal(lightingFogBrightness(1),.35);
  assert.ok(lightingFogBrightness(.5)>.35&&lightingFogBrightness(.5)<1);
  assert.equal(lightingFogBrightness(NaN),1);
});
