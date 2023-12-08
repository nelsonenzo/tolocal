import arg from 'arg';
import { help } from './help.js';
import { apply } from './apply.js';
import { config } from './config.js';
import { destroy } from './destroy.js';
import { up } from './up.js';
import os from 'os';
import path from 'path';
const homedir = os.homedir();

function parseArgumentsIntoOptions(rawArgs) {
 const args = arg(
   {
     '--dev': Boolean,
   },
   {
     argv: rawArgs.slice(2),
   }
 );
 return {
    command: args._[0],
    configDir: path.join(homedir,'.tolocal'),
    isDev: args['--dev'] || false
 };
}

export default async function cli(args) {
    let options = parseArgumentsIntoOptions(args);
    switch(options.command) {
        case "help":
          help(options);
          break;
        case "config":
          config(options);
          break;
        case "apply":
          apply(options);
          break;
        case "destroy":
          destroy(options);
          break;
        case "up":
          up(options);
          break;
        default:
          console.log(`unrecognized command ${options.command}`)
      }
}