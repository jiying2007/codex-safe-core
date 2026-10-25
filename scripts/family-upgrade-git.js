#!/usr/bin/env node
'use strict';

const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {familyGitEnvironment}=require('./family-read-auth');

function upgradeGitEnvironment(source=process.env){
  // The upgrade's existing GH_TOKEN is its authorized write credential. A
  // separately supplied read token must not silently replace it for pushes.
  if(typeof source.GH_TOKEN!=='string'||source.GH_TOKEN==='')throw new Error('Family Upgrade requires its existing GH_TOKEN credential.');
  const env=familyGitEnvironment({...source,CODEX_SAFE_FAMILY_READ_TOKEN:source.GH_TOKEN});
  delete env.FAMILY_BOT_TOKEN;
  return env;
}
function runUpgradeCommand(mode,args,{source=process.env,execute=spawnSync}={}){
  if(mode!=='git'&&mode!=='repin')throw new Error('Expected git or repin command.');
  const command=mode==='git'?'git':process.execPath;
  const commandArgs=mode==='git'?[...args]:[path.join(__dirname,'repin-consumer.js'),...args];
  const result=execute(command,commandArgs,{env:upgradeGitEnvironment(source),stdio:'inherit'});
  if(result.error)throw new Error(`Family Upgrade subprocess could not start (${result.error.code||'spawn_error'}).`);
  return Number.isInteger(result.status)?result.status:1;
}
if(require.main===module){
  try{process.exitCode=runUpgradeCommand(process.argv[2],process.argv.slice(3));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={runUpgradeCommand,upgradeGitEnvironment};
