import fs from 'fs';
import path from 'path';
import ncp from 'ncp';
import { promisify } from 'util';
const copy = promisify(ncp);
import execa from 'execa';
import inquirer from 'inquirer';

import { fromIni } from '@aws-sdk/credential-providers';
import { EC2 } from '@aws-sdk/client-ec2';
import { Route53 } from '@aws-sdk/client-route-53';

import { publicIpv4 } from 'public-ip';
import keygen from 'ssh-keygen';

async function tolocalConfigDir(options){
  let dir = options.configDir;
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
}
async function sshKeyGen(options){
  let location = path.join(options.configDir,'tolocal_rsa')
  keygen({
    location: location,
    read: true
  }, function(err, out){
    if(err) return console.log('config sshKeyGen Failed: '+err);
    return true;
    // console.log('Keys created!');
    // console.log('private key: '+out.key);
    // console.log('public key: '+out.pubKey);
  });
}
async function copyTerraformFiles(options) {
  const templateDir = path.resolve(
    new URL(import.meta.url).pathname,
    '../../terraform'
  );
  let copy_files = []
  let main_file = path.join(options.configDir,'main.tf')
  let user_data_file = path.join(options.configDir,'user_data.sh.tpl')

  const copy_file = async (options,filename) => {
    return copy(path.join(templateDir,filename), path.join(options.configDir,filename), {
      clobber: true,
    });
  }

// this coppies the file, but for some reason tfvars will not get read
// tried using await througought and it had no effect.
// it should already be awaited at the bottom, when this function is called.
// work around, use --dev flag, then run again without it.
  if (options.isDev) {
    copy_files = [
      copy_file(options,'main.tf'),
      copy_file(options,'user_data.sh.tpl'),
      copy_file(options,'terraform.tfvars.json')]
  } else if (!fs.existsSync(main_file) || !fs.existsSync(user_data_file)){
    copy_files = [
      copy_file(options,'main.tf'),
      copy_file(options,'user_data.sh.tpl')]
  }

  return Promise.all(copy_files)
}

async function terraformInit(options){
  let dir = path.join(options.configDir,'.terraform')
  if (!fs.existsSync(dir)){
    return execa('terraform', ['init'], {
      cwd: path.join(options.configDir),
    })
  } else {
    return true;
  }
}
function readTfvars(options){
  let vars_file = path.join(options.configDir,'terraform.tfvars.json')
  if ( fs.existsSync(vars_file) ){
    var tfvarsString = fs.readFileSync(vars_file,'utf8')
    return JSON.parse(tfvarsString)
  } else {
    return {}
  }
}

async function promptForMissingOptions(options,tfvars) {
  var my_ip = await publicIpv4()

  ////////////////////////
  // input: aws profile
  ////////////////////////
  var aws_profile_default = tfvars.hasOwnProperty('aws_profile') ? tfvars.aws_profile : "default"
  var aws_profile = await inquirer.prompt({
    type: 'input',
    name: 'aws_profile',
    message: 'AWS_PROFILE to use',
    default: aws_profile_default
  })
  var credentials = fromIni({profile: aws_profile.aws_profile});
  ////////////////////////
  // input: aws region
  ////////////////////////
  var aws_region_default = tfvars.hasOwnProperty('aws_region') ? tfvars.aws_region : "us-east-2"
  var aws_region = await inquirer.prompt({
    type: 'input',
    name: 'aws_region',
    message: 'AWS region',
    default: aws_region_default
  })

  ////////////////////////
  // input: vpc id
  ////////////////////////
  const ec2 = new EC2({
    credentials: credentials,
    region: aws_region.aws_region,
  })
  const raw_vpcs = await ec2.describeVpcs([])
  var vpc_ids = raw_vpcs.Vpcs.map(vpc => {
    // console.log({vpc_id: vpc.VpcId, cidr: vpc.CidrBlock, default: vpc.IsDefault})
    return vpc.VpcId
  })
  const vpc_id_default = tfvars.hasOwnProperty('vpc_id') ? tfvars.vpc_id : ""
  let vpc_input = await inquirer.prompt({
                      type: 'list',
                      name: 'vpc_id',
                      message: `Please choose which vpc to use from region: ${aws_region.aws_region}`,
                      choices: vpc_ids,
                      default: vpc_id_default
                      })
  options = {
    ...options,
    vpc_id: vpc_input.vpc_id
    }

  ////////////////////////
  // input: subnet id
  ////////////////////////
  var subnet_params = {
    Filters: [
      {
      Name: "vpc-id",
      Values: [
        options.vpc_id
      ]
    }
    ]
  };
  const raw_subnet_ids = await ec2.describeSubnets(subnet_params)
  var subnet_ids = raw_subnet_ids.Subnets.map(subnet => {
    // TODO: known bug. this breaks if there are no tags.
    var nameTag = subnet.Tags.filter(data => (data.Key == "Name"))
    var name = nameTag.length == 0 ? "" : nameTag[0].Value
    return {
      name: `name: ${name}, id: ${subnet.SubnetId}, az: ${subnet.AvailabilityZone}, cidr: ${subnet.CidrBlock}`,
      value: subnet.SubnetId,
      short: subnet.SubnetId,
      seperator: '|'
    }
  })
  const subnet_id_default = tfvars.hasOwnProperty('subnet_id') ? tfvars.subnet_id : ""
  var subnet_id = await inquirer.prompt({
                      type: 'list',
                      name: 'subnet_id',
                      message: `Please choose which subnet to use from vpc id ${options.vpc_id}`,
                      choices: subnet_ids,
                      default: subnet_id_default
                      });
  ////////////////////////
  // input: hosted zone
  ////////////////////////
  var route53 = new Route53({
    credentials: credentials,
    region: aws_region.aws_region,
  });
  const raw_hosted_zones = await route53.listHostedZones()
  // TODO: handle case when there are no hosted zones.
  // console.log(hosted_zones)
  var hosted_zones = raw_hosted_zones.HostedZones.map(zone => {
    return zone.Name.slice(0, -1);
  })
  var dns_host_zone_default = tfvars.hasOwnProperty('dns_host_zone') ? tfvars.dns_host_zone : ""
  var dns_host_zone = await inquirer.prompt({
                            type: 'list',
                            name: 'dns_host_zone',
                            message: 'Please choose which dns host zone:',
                            choices: hosted_zones,
                            default: dns_host_zone_default
                            });

  ////////////////////////
  // input: subdomain=localport tunnel mappings
  ////////////////////////
  // whats not here?
  // no default for local tunnels
  // why not?
  // stringFromTfvarsArray
  // that string is:
  // for each record, concat subdomain=localport
  var local_tunnel_input_default = "www.dev:3000"
  if (tfvars.hasOwnProperty('local_tunnels')) {
    local_tunnel_input_default = tfvars.local_tunnels.map(tunnel => {
      return `${tunnel.subdomain}=${tunnel.localport}`
    }).join(' ')
  }

  var local_tunnel_input = await inquirer.prompt({
                                  type: 'string',
                                  name: 'local_tunnel_input',
                                  message: `subdomain to localport mappings in the following format:
www.nelson=3000 api.nelson=4000 auth.nelson=5000
`,
                                  default: local_tunnel_input_default
                                  });

var transform_tunnel_input = (local_tunnel_input) => {
  var proxyport = 8000
  // split by spaces for each subdomain
  // then split by = for port mappping
  var subdomains = local_tunnel_input.split(' ')
  return subdomains.map(sub => {
    proxyport = proxyport + 1
    var params = sub.split('=')
    var subdomain = params[0]
    var localport = params[1]
    var full_domain = `${subdomain}.${dns_host_zone.dns_host_zone}`
    return {subdomain: subdomain, localport: localport, proxyport: proxyport, full_domain: full_domain }
  })
}

var local_tunnels = transform_tunnel_input(local_tunnel_input.local_tunnel_input)

  ////////////////////////
  // input: ssh_public_key_file_path
  ////////////////////////
  const ssh_public_key_file_path_default = tfvars.hasOwnProperty('ssh_public_key_file_path') ? tfvars.ssh_public_key_file_path : ""
  var ssh_public_key_file_path = await inquirer.prompt({
                                        type: 'string',
                                        name: 'ssh_public_key_file_path',
                                        message: "ssh PUBLIC key file location on your local hard drive",
                                        default: ssh_public_key_file_path_default
                                        });

  // //////////////////////
  // input: ssh_private_key_file_path
  // //////////////////////
  const ssh_private_key_file_path_default = tfvars.hasOwnProperty('ssh_private_key_file_path') ? tfvars.ssh_private_key_file_path : ""
  var ssh_private_key_file_path = await inquirer.prompt({
    type: 'string',
    name: 'ssh_private_key_file_path',
    message: "ssh PRIVATE key file location on your local hard drive",
    default: ssh_private_key_file_path_default
    });

  // //////////////////////
  // input: basic auth credentials
  // //////////////////////
    const tolocal_auth_default =  tfvars.hasOwnProperty('tolocal_auth') ? tfvars.tolocal_auth : "admin:change-me-please"

    var tolocal_auth =  await inquirer.prompt({
      type: 'string',
      name: 'tolocal_auth',
      message: "please input BASIC Auth in the format of username:password",
      default: tolocal_auth_default
      });

  ////////////////////////////////////
  // the final return statement
  ////////////////////////////////////
  return {
    ...options,
    command: options.command,
    tfvars: {
      aws_profile: aws_profile.aws_profile,
      aws_region: aws_region.aws_region,
      vm_size: "t2.micro",
      vpc_id: options.vpc_id,
      subnet_id: subnet_id.subnet_id,
      http_only: false,
      dns_host_zone: dns_host_zone.dns_host_zone,
      local_tunnels: local_tunnels,
      ssh_public_key_file_path: ssh_public_key_file_path.ssh_public_key_file_path,
      ssh_private_key_file_path: ssh_private_key_file_path.ssh_private_key_file_path,
      my_ip: `${my_ip}/32`,
      tolocal_auth: tolocal_auth.tolocal_auth
    }

  };
}
async function tolocalConfigFile(options) {
  // fs = require('fs');
  var filepath = path.join(options.configDir,"terraform.tfvars.json")
  var blob = JSON.stringify(options.tfvars, null, '\t')
  return fs.writeFile(filepath, blob, (err) => {
    if (err) throw err;
  })
}
export async function config(options) {
  await tolocalConfigDir(options).catch( (e) => {console.log(e)})
  await copyTerraformFiles(options).catch( (e) => {console.log(e)})
  await terraformInit(options).catch( (e) => {console.log(e)})
  let tfvars = readTfvars(options)
    // promtForMissingOptions
    // write tfvars file
    // return tfvars.json blob + options
  if (!options.isDev) {
    options = await promptForMissingOptions(options,tfvars).catch(e=>{console.log(e)});
    await tolocalConfigFile(options).catch( (e) => {console.log(e)})
  }


  // console.log(options)
  console.log("config ran");
  return options;
}
