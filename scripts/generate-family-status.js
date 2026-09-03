#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const contract=require('../core-contract.json');
const {collectState}=require('./family-freshness');

async function buildStatus(){
  const state=await collectState();
  const now=new Date().toISOString();
  return {
    schemaVersion:Number(contract.familyStatusVersion),
    generatedAt:now,
    healthy:state.ready&&state.dispatch===false&&state.reason==='family-manifest-current',
    core:{version:state.core.version,sha:state.core.sha,releaseReady:state.core.releaseReady,releaseTag:state.core.release?.tag||null},
    consumers:Object.fromEntries(Object.entries(state.consumers).map(([name,value])=>[name,{version:value.version,sha:value.sha,coreAligned:value.aligned,releaseReady:value.releaseReady,distributionReady:value.distributionReady,releaseTag:value.release?.tag||null,distribution:value.distribution?.channel||null,reason:value.reason}])),
    family:{ready:state.ready,dispatch:state.dispatch,reason:state.reason,manifestDigest:state.manifestDigest||null}
  };
}
async function main(){const status=await buildStatus(),out=process.argv[2]?path.resolve(process.argv[2]):null,json=JSON.stringify(status,null,2)+'\n';if(out)fs.writeFileSync(out,json);else process.stdout.write(json);}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message||String(error));process.exitCode=1;});
module.exports={buildStatus};
