// import statements, constants, and functions for this block of code to work.
import execa from 'execa';
import path from 'path';

async function terraformApply(options) {
  // TODO:FIX: once you add .stdout.pipe(process.stdout) then await has not bearing.
  const result = await execa('terraform', ['apply' ,'--auto-approve'], {
    cwd: path.join(options.configDir),
  })
  
  if (result.failed) {
    return Promise.reject(new Error('Failed to terraform apply'));
  }
  return;
}

// last, but not least, export a function which you call from cli.js.
export async function apply(options) {
  console.log("Please be patient. It takes 2-3 minutes to stand up the ec2.")
  await terraformApply(options).catch( err => {console.log(err)})
  console.log("terraform finished applying. Give it 5 minutes before running sudo tolocal up. This lets the ec2, dns, and certbot to resolve.")
  return true;
 }