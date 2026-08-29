'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{PROFILE_PACK_VERSION,PROFILE_PACK_NAMES,resolveReviewProfilePack,formatProfilePackEvidence}=require('../review-profile-pack');

test('profile packs expose versioned engineering profiles',()=>{assert.equal(PROFILE_PACK_VERSION,1);for(const name of ['general','backend','frontend','security','cpp','embedded-linux','embedded-mcu','driver','kernel','realtime'])assert.ok(PROFILE_PACK_NAMES.includes(name));});
test('embedded-linux profile resolves through canonical base profile',()=>{const profile=resolveReviewProfilePack('embedded-linux');assert.equal(profile.packName,'embedded-linux');assert.equal(profile.baseProfile,'embedded');assert.ok(profile.checks.some(item=>/DMA cache coherency/i.test(item)));assert.match(formatProfilePackEvidence(profile),/TRUSTED REVIEW PROFILE PACK/);});
test('unknown profile pack falls back to general',()=>{assert.equal(resolveReviewProfilePack('does-not-exist').packName,'general');});
