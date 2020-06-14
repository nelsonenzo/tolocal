import execa from 'execa';

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

// last, but not least, export a function which you call from cli.js.
export async function up(options) {
  // TODO: this command stays open, cntrl+c to close child.
  //        initiate a timeout of 1 hour.
  // TODO: record process somehow, and use 'tolocal down' to exit commands.
  // execa is just a wrapper for https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
  //  stackoverflow: https://stackoverflow.com/questions/25323703/nodejs-execute-command-in-background-and-forget
    await tunnelup(configjson)
    console.log("use cntrl+c to close local tunnels. run tolocal destroy to delete infra.");
    return true;
  }