import execa from 'execa';
import path from 'path';
import fs from 'fs';

function readTfvars(options){
  let vars_file = path.join(options.configDir,'terraform.tfvars.json')
  if ( fs.existsSync(vars_file) ){
    var tfvarsString = fs.readFileSync(vars_file,'utf8')
    return JSON.parse(tfvarsString)
  } else {
    throw("~/.tolocal/terraform.tfvars.json file missing \n please run tolocal config")
  }
}
async function clearTrustedHosts(config, tunnel) {
  const result = await execa('ssh-keygen', ['-R',`${tunnel.full_domain}`]);
  // console.log(`clearTrustedHosts result: ${JSON.stringify(result)}`)
  if (result.failed) {
    console.log("remove from known hosts failed")
    // TODO: when exitCode == 255, ignore
    // else throw error and exit.
    // return Promise.reject(new Error('Failed to open ssh tunnel'));
  }
}
async function addTrustedHosts(config, tunnel) {
  const result = await execa('ssh', ['-i',`${config.ssh_private_key_file_path}`,'-o', "StrictHostKeyChecking=accept-new", `ubuntu@${tunnel.full_domain}`, "exit"]);
  // console.log(`addTrustedHosts result: ${JSON.stringify(result)}`)
  if (result.failed){
    console.log("ERROR: trusthost failed")
  }
  return;
}
async function openSSHTunnel(config,tunnel) {
 // this intentionally does not await, because it's called in a loop.
  execa('ssh', ['-i',`${config.ssh_private_key_file_path}`,
  '-N' ,'-R', `:${tunnel.sshport}:localhost:${tunnel.localport}`, `ubuntu@${tunnel.full_domain}`]);
  return;
}

async function tunnelup(config) {
  for (const tunnel of config.local_tunnels){
    await clearTrustedHosts(config,tunnel).catch( e => {console.log(e)})
    await addTrustedHosts(config,tunnel).catch( e => {console.log(e)})
    await openSSHTunnel(config,tunnel).catch( e => {console.log(e)})
  }
}

export async function up(options) {
  var tfvars = readTfvars(options)
  await tunnelup(tfvars)
  console.log("use cntrl+c to close local tunnels. run tolocal destroy to delete infra.");
  return true;
  }