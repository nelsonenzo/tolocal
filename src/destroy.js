import execa from 'execa';
import path from 'path';

async function terraformDestroy(options) {
  const result = await execa('terraform', ['destroy' , "--auto-approve"], {
    cwd: path.join(options.configDir),
  }).stdout.pipe(process.stdout);

  if (result.failed) {
    return Promise.reject(new Error('Failed to terraform apply'));
  }
  return;
}

// last, but not least, export a function which you call from cli.js.
export async function destroy(options) {
  console.log("destroy ran with options:");
  console.log(options)
  await terraformDestroy(options).catch( err => {console.log(err)})
  return true;
  }