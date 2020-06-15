## ToLocal
## What does this do?
reverse proxies https requests from a public domain to your localhost, through an ssh tunnel.
for example:

https://api.dev.yourdomain.com -> localhost:4000

You own the domain, nginx config, and ssh tunnel. It's all yours.

### How does it do it?
tolocal is an npm cli that wraps terraform. 

The terraform creates:
- an ec2 with nginx
- a security group
- dns records

Use `tolocal config` and it will prompt you for all the necessary aws config variables.  
It queries your aws account as it goes, so it's super simple to select your vpc, public subnet, and dns hostzone.
## All Commands
```
tolocal config [--dev]
tolocal apply
tolocal up
tolocal destroy
tolocal help
```
## Install
```
npm i -g tolocal
```
#### Get Started
```
tolocal config
```
the config command will
- prompt for aws info:
  - profile
  - region
  - vpc
  - PUBLIC subnet
  - route53 dns host zone
- prompt for subdomains=localport mappings
- prompt for your ssh public and private key file locations 
  - your public key goes on the ec2, your private key is used to start ssh tunnels.

#### Create the infrastructure in aws
```
tolocal apply
```
#### Open the ssh tunnels
This opens an ssh reverse tunel. If you run `ps aux`, you will see it running in the background:

`ssh -i ~/.ssh/private-ssh.key -N -R :8001:localhost:4000 ubuntu@www.dev.yourdomain.com`

This ssh tunnel is how tolocal can securely usher traffic to your http service on localhost.
```
tolocal up
```
#### Destroy the infra
To stop paying for the t2.micro (~$8/mo when run 24/7*30) by destroying the infra.
```
tolocal destroy
```
#### Redeploy
You don't need to run config if nothing has changed.
```
tolocal apply
tolocal up
```

## What Get's created?
- t2.micro ec2 running nginx
- ec2 security group
- route53 dns records

## Does it create a host zone?
No, an existing route53 dns host zone is required.

## What about HTTP & HTTPS?
- http is redirected to https
- https is resolved with Lets Encrypt certbot on ec2 creation.

## Development
get started
```
git clone git@github.com:nelsonenzo/tolocal.git
cd tolocal
npm link
```
For the initial config, run
```
tolocal config
```
Copy terraform.tfvars.json to the github repo terraform/terraform.tfvars.json
```
cp $HOME/.tolocal/terraform.tfvars.json ./terraform/terraform.tfvars.json
```
You can now edit that local terraform/terraform.tfvars.json file and run:
```
tolocal config --dev
``` 
This coppies the usual required template files + your json config, and skips prompts.
It just makes development easier.

You can explore your $HOME/.tolocal directory to see what is created at any time. 

Terraforms state is stored in that directory after `tolocal apply`
```
cd ~/.tolocal
~/.tolocal$ tree
.
├── main.tf
├── terraform.tfstate
├── terraform.tfstate.backup
├── terraform.tfvars.json
└── user_data.sh.tpl
```


if you are an npm collaborator on tolocal
```
npm publish --access public
```