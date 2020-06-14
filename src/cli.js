import arg from 'arg';
import { help } from './help';
import { create } from './create';
import { config } from './config';
import { destroy } from './destroy';
import { up } from './up';
import os from 'os';
import path from 'path';
const homedir = os.homedir();

function parseArgumentsIntoOptions(rawArgs) {
 const args = arg(
   {
     '--http-only': Boolean,
     '--config-dir': String,
     '--auto-approve': Boolean,
     '--dev': Boolean,
     '-h': '--http-only',
     '-y': '--auto-approve'
   },
   {
     argv: rawArgs.slice(2),
   }
 );
 return {
    command: args._[0],
    httpOnly: args['--http-only'] || false,
    // TODO: correct default get's users home directory + const homedir = require('os').homedir();
    configDir: path.join(homedir,'.tolocal'),
    autoApprove: args['--auto-approve'] || false,
    isDev: args['--dev'] || false
 };
}


   
export async function cli(args) {
    let options = parseArgumentsIntoOptions(args);
    // options = await config(options);
    switch(options.command) {
        case "help":
            help(options);
            break;
        case "config":
            config(options);
            break;
        case "create":
            create(options);
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
    // console.log(options);
}